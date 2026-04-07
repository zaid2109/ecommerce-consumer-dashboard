import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import type { UserRole } from '@prisma/client'
import { enforceCsrf } from '@/lib/server/security'
import { checkPlanLimit } from '@/lib/server/plan-limits'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'member:manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const members = await prisma.user.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, role: true, lastLogin: true, createdAt: true },
  })

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'member:manage')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { email?: string; role?: UserRole; password?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const role = (body.role ?? 'VIEWER') as UserRole
  const password = (body.password ?? '').trim()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!password) {
    return NextResponse.json({ error: 'Password is required. Use invitation onboarding or provide a strong password.' }, { status: 400 })
  }
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return NextResponse.json(
      { error: 'Password must be at least 12 characters and include upper, lower, number, and symbol.' },
      { status: 400 }
    )
  }

  const planCheck = await checkPlanLimit({
    workspaceId: auth.workspaceId,
    metric: 'seats',
    increment: 1,
  })
  if (!planCheck.ok) {
    return NextResponse.json({ error: planCheck.message }, { status: 403 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const member = await prisma.user.create({
    data: {
      workspaceId: auth.workspaceId,
      email,
      role,
      passwordHash,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'member.create',
      resourceType: 'user',
      resourceId: member.id,
      metadata: { role },
    },
  })

  return NextResponse.json({ member }, { status: 201 })
}
