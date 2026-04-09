import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { getConnectorSyncQueue } from '@/lib/server/connector-queue'
import { runConnectorSync } from '@/lib/server/connectors'
import { ingestConnectorToDataset } from '@/lib/server/connector-ingestion'
import { allowAction } from '@/lib/server/rate-limit'
import { enforceCsrf } from '@/lib/server/security'
import { decryptConnectorConfig } from '@/lib/server/connector-secrets'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await allowAction({
    key: `${auth.workspaceId}:${auth.userId}`,
    action: 'connector-scheduled-sync',
    limit: 5,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  const connectors = await prisma.connector.findMany({
    where: { workspaceId: auth.workspaceId, status: { not: 'DISCONNECTED' } },
    select: { id: true, type: true },
  })

  const queue = getConnectorSyncQueue()
  let enqueued = 0
  if (queue) {
    for (const connector of connectors) {
      const syncJob = await prisma.connectorSyncJob.create({
        data: {
          connectorId: connector.id,
          workspaceId: auth.workspaceId,
          trigger: 'SCHEDULED',
          status: 'QUEUED',
          attempts: 0,
          maxAttempts: Number(process.env.CONNECTOR_SYNC_MAX_ATTEMPTS ?? 3),
        },
      })
      await queue.add(
        'connector-sync',
        { connectorId: connector.id, workspaceId: auth.workspaceId, syncJobId: syncJob.id },
        { jobId: syncJob.id }
      )
      enqueued += 1
    }
    return NextResponse.json({ queued: enqueued, mode: 'queue' })
  }

  for (const connector of connectors) {
    const syncJob = await prisma.connectorSyncJob.create({
      data: {
        connectorId: connector.id,
        workspaceId: auth.workspaceId,
        trigger: 'SCHEDULED',
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: Number(process.env.CONNECTOR_SYNC_MAX_ATTEMPTS ?? 3),
        startedAt: new Date(),
      },
    })
    try {
      const connectorWithConfig = await prisma.connector.findUnique({ where: { id: connector.id } })
      const decryptedConfig = decryptConnectorConfig(connectorWithConfig?.config ?? null)
      const result = await runConnectorSync(
        connector.type,
        decryptedConfig
      )
      const ingestion = await ingestConnectorToDataset({
        connectorId: connector.id,
        workspaceId: auth.workspaceId,
        connectorType: connector.type,
        config: decryptedConfig,
        createdByUserId: auth.userId,
      })
      await prisma.connector.update({
        where: { id: connector.id },
        data: {
          status: 'CONNECTED',
          rowsSynced: { increment: result.rowsSynced },
          lastSyncAt: new Date(),
          lastError: null,
        },
      })
      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          userId: auth.userId,
          action: 'connector.sync.scheduled',
          resourceType: 'connector',
          resourceId: connector.id,
          metadata: {
            ...result.metadata,
            ingestion,
          } as Prisma.InputJsonValue,
        },
      })
      await prisma.connectorSyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: {
            ...result.metadata,
            ingestion,
          } as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled sync failed'
      await prisma.connector.update({
        where: { id: connector.id },
        data: { status: 'ERROR', lastError: message },
      })
      await prisma.connectorSyncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: message,
        },
      })
    }
  }

  return NextResponse.json({ queued: connectors.length, mode: 'inline-no-queue' })
}
