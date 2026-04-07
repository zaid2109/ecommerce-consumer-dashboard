import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { codeChallengeS256, randomCodeVerifier, randomState } from '@/lib/server/oauth'

export const runtime = 'nodejs'

function resolveProvider(input: string): 'google' | 'microsoft' | null {
  if (input === 'google') return 'google'
  if (input === 'microsoft') return 'microsoft'
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

  const state = randomState()
  const codeVerifier = randomCodeVerifier()
  const codeChallenge = codeChallengeS256(codeVerifier)
  const redirectBase = process.env.OAUTH_REDIRECT_BASE_URL?.trim() || req.nextUrl.origin
  const redirectUri = `${redirectBase}/api/auth/oauth/${provider}/callback`
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.oAuthState.create({
    data: {
      provider,
      state,
      codeVerifier,
      redirectUri,
      expiresAt,
    },
  })

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? ''
    if (!clientId) {
      return NextResponse.json({ error: 'GOOGLE_OAUTH_CLIENT_ID is not configured' }, { status: 501 })
    }
    const scopes = encodeURIComponent('openid email profile')
    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&access_type=offline&prompt=consent`
    return NextResponse.json({ authorizationUrl: url, provider })
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID ?? ''
  const tenant = process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common'
  if (!clientId) {
    return NextResponse.json({ error: 'MICROSOFT_OAUTH_CLIENT_ID is not configured' }, { status: 501 })
  }
  const scopes = encodeURIComponent('openid profile email User.Read')
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`
  return NextResponse.json({ authorizationUrl: url, provider })
}

