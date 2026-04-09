import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const agreements = await prisma.dpaAgreement.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { acceptedAt: 'desc' },
  })
  return NextResponse.json({ agreements })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { version?: string; metadata?: unknown }
  const version = (body.version ?? '').trim()
  if (!version) return NextResponse.json({ error: 'version is required' }, { status: 400 })
  const agreement = await prisma.dpaAgreement.create({
    data: {
      workspaceId: auth.workspaceId,
      acceptedById: auth.userId,
      version,
      metadata:
        typeof body.metadata === 'object' && body.metadata !== null
          ? (body.metadata as Prisma.InputJsonValue)
          : undefined,
    },
  })
  return NextResponse.json({ agreement }, { status: 201 })
}
