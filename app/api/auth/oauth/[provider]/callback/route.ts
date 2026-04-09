import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { createAuthSession } from '@/lib/server/auth'
import { createCsrfToken } from '@/lib/server/security'

export const runtime = 'nodejs'

function resolveProvider(input: string): 'google' | 'microsoft' | null {
  if (input === 'google') return 'google'
  if (input === 'microsoft') return 'microsoft'
  return null
}

type OAuthTokenResponse = {
  access_token?: string
  id_token?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

function readEmailFromTokenPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null
  const email = payload.email
  if (typeof email === 'string' && email.trim()) return email.trim().toLowerCase()
  const upn = payload.upn
  if (typeof upn === 'string' && upn.trim()) return upn.trim().toLowerCase()
  return null
}

export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = resolveProvider(params.provider)
  if (!provider) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
  }

  const state = req.nextUrl.searchParams.get('state') ?? ''
  const code = req.nextUrl.searchParams.get('code') ?? ''
  if (!state || !code) {
    return NextResponse.json({ error: 'Missing OAuth state or code' }, { status: 400 })
  }

  const oauthState = await prisma.oAuthState.findFirst({
    where: {
      provider,
      state,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (!oauthState) {
    return NextResponse.json({ error: 'Invalid or expired OAuth state' }, { status: 400 })
  }

  await prisma.oAuthState.update({
    where: { id: oauthState.id },
    data: { usedAt: new Date() },
  })

  const clientId =
    provider === 'google'
      ? process.env.GOOGLE_OAUTH_CLIENT_ID ?? ''
      : process.env.MICROSOFT_OAUTH_CLIENT_ID ?? ''
  const clientSecret =
    provider === 'google'
      ? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ''
      : process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'OAuth client credentials are not configured' }, { status: 501 })
  }

  const tokenUrl =
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : `https://login.microsoftonline.com/${encodeURIComponent(process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common')}/oauth2/v2.0/token`

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthState.redirectUri,
      code_verifier: oauthState.codeVerifier,
    }),
  })
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'OAuth token exchange failed' }, { status: 401 })
  }
  const tokenPayload = (await tokenRes.json()) as OAuthTokenResponse
  const idToken = tokenPayload.id_token ?? ''
  if (!idToken) {
    return NextResponse.json({ error: 'OAuth provider did not return an id_token' }, { status: 401 })
  }
  const email = readEmailFromTokenPayload(decodeJwtPayload(idToken))
  if (!email) {
    return NextResponse.json({ error: 'Unable to resolve account email from OAuth identity token' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'No existing account found for OAuth identity email' }, { status: 404 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')
  const session = await createAuthSession({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
    ip,
    userAgent,
  })

  const response = NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin))
  response.cookies.set('access_token', session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  })
  response.cookies.set('refresh_token', session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  })
  response.cookies.set('session_id', session.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  })
  response.cookies.set('csrf_token', createCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  })
  response.headers.set('x-auth-provider', provider)
  return response
}

