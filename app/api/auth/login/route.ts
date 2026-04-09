import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/server/prisma'
import { createAuthSession } from '@/lib/server/auth'
import { createCsrfToken } from '@/lib/server/security'
import { allowAuthAttempt } from '@/lib/server/auth-rate-limit'
import { consumeBackupCode, verifyTotpCode } from '@/lib/server/mfa'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const allowed = await allowAuthAttempt({
    key: ip,
    action: 'auth-login',
    limit: 8,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 })
  }

  const body = (await req.json()) as { email?: string; password?: string; mfaCode?: string; backupCode?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (user.mfaEnabled) {
    const mfaCode = (body.mfaCode ?? '').trim()
    const backupCode = (body.backupCode ?? '').trim()
    let mfaVerified = false
    let nextBackupCodes = (user.mfaBackupCodes as string[] | null) ?? []

    if (mfaCode && user.mfaSecret) {
      mfaVerified = verifyTotpCode({ secret: user.mfaSecret, code: mfaCode })
    }

    if (!mfaVerified && backupCode && nextBackupCodes.length > 0) {
      const consumed = await consumeBackupCode({
        providedCode: backupCode,
        hashedCodes: nextBackupCodes,
      })
      if (consumed.ok) {
        mfaVerified = true
        nextBackupCodes = consumed.remainingHashedCodes
      }
    }

    if (!mfaVerified) {
      return NextResponse.json({ error: 'MFA code required or invalid', mfaRequired: true }, { status: 401 })
    }

    if (nextBackupCodes.length !== ((user.mfaBackupCodes as string[] | null) ?? []).length) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaBackupCodes: nextBackupCodes },
      })
    }
  }

  const userAgent = req.headers.get('user-agent')
  const session = await createAuthSession({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
    ip,
    userAgent,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
    },
  })
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

  return response
}
