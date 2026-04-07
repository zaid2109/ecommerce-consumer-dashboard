import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/server/prisma'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const body = (await req.json()) as {
    token?: string
    password?: string
  }
  const token = (body.token ?? '').trim()
  const password = body.password ?? ''
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }

  const invitations = await prisma.invitation.findMany({
    where: {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  let matched = null as (typeof invitations)[number] | null
  for (const invite of invitations) {
    const ok = await bcrypt.compare(token, invite.tokenHash)
    if (ok) {
      matched = invite
      break
    }
  }
  if (!matched) {
    return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      workspaceId: matched.workspaceId,
      email: matched.email,
      role: matched.role,
      passwordHash,
    },
    select: { id: true, email: true, role: true, workspaceId: true },
  })

  await prisma.invitation.update({
    where: { id: matched.id },
    data: { acceptedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: matched.workspaceId,
      userId: user.id,
      action: 'invite.accept',
      resourceType: 'invitation',
      resourceId: matched.id,
      metadata: { email: matched.email },
    },
  })

  return NextResponse.json({ user })
}
