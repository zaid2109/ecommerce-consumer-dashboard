import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connectorId = req.nextUrl.searchParams.get('connectorId') ?? undefined
  const jobs = await prisma.connectorSyncJob.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(connectorId ? { connectorId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      connectorId: true,
      trigger: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      errorMessage: true,
      deadLetterReason: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  })

  return NextResponse.json({ jobs })
}
