import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/server/prisma'
import { createAuthSession } from '@/lib/server/auth'
import { createCsrfToken } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; token?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const token = (body.token ?? '').trim()
  if (!email || !token) {
    return NextResponse.json({ error: 'Email and token are required' }, { status: 400 })
  }

  const candidates = await prisma.magicLinkToken.findMany({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  let matched: (typeof candidates)[number] | null = null
  for (const item of candidates) {
    const ok = await bcrypt.compare(token, item.tokenHash)
    if (ok) {
      matched = item
      break
    }
  }
  if (!matched) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
  }

  await prisma.magicLinkToken.update({
    where: { id: matched.id },
    data: { usedAt: new Date() },
  })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip')
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
    accessToken: session.accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
    },
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

