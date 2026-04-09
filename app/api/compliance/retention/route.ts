import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const policies = await prisma.retentionPolicy.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ policies })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { resourceType?: string; retentionDays?: number; enabled?: boolean }
  const resourceType = (body.resourceType ?? '').trim()
  if (!resourceType) return NextResponse.json({ error: 'resourceType is required' }, { status: 400 })
  const retentionDays = Math.max(1, body.retentionDays ?? 30)
  const policy = await prisma.retentionPolicy.create({
    data: {
      workspaceId: auth.workspaceId,
      resourceType,
      retentionDays,
      enabled: body.enabled ?? true,
    },
  })
  return NextResponse.json({ policy }, { status: 201 })
}
