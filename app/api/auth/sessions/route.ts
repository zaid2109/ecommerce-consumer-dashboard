import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentSessionId = req.cookies.get('session_id')?.value ?? null
  const sessions = await prisma.session.findMany({
    where: { userId: auth.userId },
    orderBy: { expiresAt: 'desc' },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      expiresAt: true,
    },
    take: 20,
  })

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    })),
  })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentSessionId = req.cookies.get('session_id')?.value ?? null
  await prisma.session.deleteMany({
    where: {
      userId: auth.userId,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.session.revoke_others',
      resourceType: 'session',
      resourceId: currentSessionId,
      metadata: {},
    },
  })

  return NextResponse.json({ ok: true })
}

