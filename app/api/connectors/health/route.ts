import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [connectors, recentJobs] = await Promise.all([
    prisma.connector.findMany({
      where: { workspaceId: auth.workspaceId },
      select: { id: true, status: true, lastSyncAt: true, rowsSynced: true },
    }),
    prisma.connectorSyncJob.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { status: true, completedAt: true },
    }),
  ])

  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000
  const completedLastHour = recentJobs.filter(
    (job) => job.status === 'COMPLETED' && job.completedAt && job.completedAt.getTime() >= oneHourAgo
  ).length
  const failedLastHour = recentJobs.filter(
    (job) =>
      (job.status === 'FAILED' || job.status === 'DEAD_LETTER') &&
      job.completedAt &&
      job.completedAt.getTime() >= oneHourAgo
  ).length

  return NextResponse.json({
    totalConnectors: connectors.length,
    connected: connectors.filter((c) => c.status === 'CONNECTED').length,
    errored: connectors.filter((c) => c.status === 'ERROR').length,
    disconnected: connectors.filter((c) => c.status === 'DISCONNECTED').length,
    completedLastHour,
    failedLastHour,
    successRateLastHour:
      completedLastHour + failedLastHour > 0
        ? Number(((completedLastHour / (completedLastHour + failedLastHour)) * 100).toFixed(2))
        : null,
  })
}
