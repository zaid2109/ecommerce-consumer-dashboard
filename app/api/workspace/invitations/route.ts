import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'invite:manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const invitations = await prisma.invitation.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { expiresAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
    },
  })
  return NextResponse.json({ invitations })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'invite:manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { email?: string; role?: UserRole }
  const email = (body.email ?? '').trim().toLowerCase()
  const role = (body.role ?? 'VIEWER') as UserRole
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const tokenHashInput = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(tokenHashInput, 12)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      workspaceId: auth.workspaceId,
      email,
      role,
      tokenHash,
      expiresAt,
    },
    select: { id: true, email: true, role: true, expiresAt: true },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'invite.create',
      resourceType: 'invitation',
      resourceId: invitation.id,
      metadata: { email, role },
    },
  })

  return NextResponse.json({
    invitation,
  }, { status: 201 })
}
