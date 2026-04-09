import { NextRequest, NextResponse } from 'next/server'
import { rotateRefreshSession } from '@/lib/server/auth'
import { createCsrfToken } from '@/lib/server/security'
import { allowAuthAttempt } from '@/lib/server/auth-rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const allowed = await allowAuthAttempt({
    key: ip,
    action: 'auth-refresh',
    limit: 20,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many refresh attempts. Please try again later.' }, { status: 429 })
  }

  const refreshToken = req.cookies.get('refresh_token')?.value
  const sessionId = req.cookies.get('session_id')?.value
  if (!refreshToken || !sessionId) {
    return NextResponse.json({ error: 'Missing refresh session' }, { status: 401 })
  }

  const userAgent = req.headers.get('user-agent')
  const rotated = await rotateRefreshSession({
    sessionId,
    refreshToken,
    ip,
    userAgent,
  })
  if (!rotated) {
    return NextResponse.json({ error: 'Invalid refresh session' }, { status: 401 })
  }

  const response = NextResponse.json({
    auth: rotated.auth,
  })

  response.cookies.set('access_token', rotated.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: rotated.expiresAt,
  })

  response.cookies.set('refresh_token', rotated.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: rotated.expiresAt,
  })
  response.cookies.set('session_id', rotated.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: rotated.expiresAt,
  })
  response.cookies.set('csrf_token', createCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: rotated.expiresAt,
  })

  return response
}
