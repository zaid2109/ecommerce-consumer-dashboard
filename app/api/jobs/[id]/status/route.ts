import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await prisma.ingestionJob.findFirst({
    where: {
      id: params.id,
      workspaceId: auth.workspaceId,
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      metadata: true,
      datasetId: true,
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: job.status,
    progress: typeof (job.metadata as { progress?: unknown } | null)?.progress === 'number'
      ? (job.metadata as { progress: number }).progress
      : 0,
    error: job.errorMessage,
    result: {
      jobId: job.id,
      datasetId: job.datasetId,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  })
}
