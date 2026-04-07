import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { runConnectorSync } from '@/lib/server/connectors'
import { decryptConnectorConfig } from '@/lib/server/connector-secrets'
import { logError, logJobEvent } from '@/lib/server/logger'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const worker = new Worker(
  'connector-sync-jobs',
  async (job) => {
    const { connectorId, workspaceId } = job.data as {
      connectorId: string
      workspaceId: string
      syncJobId?: string
    }
    logJobEvent({
      jobId: String(job.id),
      workspaceId,
      connectorId,
      stage: 'connector.sync',
      status: 'processing',
      rowsProcessed: 0,
    })
    const syncJobId = job.data.syncJobId as string | undefined
    if (syncJobId) {
      await prisma.connectorSyncJob.updateMany({
        where: { id: syncJobId, workspaceId },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, startedAt: new Date() },
      })
    }

    const connector = await prisma.connector.findFirst({
      where: { id: connectorId, workspaceId },
    })
    if (!connector) {
      throw new Error('Connector not found')
    }

    const result = await runConnectorSync(connector.type, decryptConnectorConfig(connector.config))
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
        workspaceId,
        action: 'connector.sync.worker',
        resourceType: 'connector',
        resourceId: connector.id,
        metadata: result.metadata as Prisma.InputJsonValue,
      },
    })
    if (syncJobId) {
      await prisma.connectorSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: result.metadata as Prisma.InputJsonValue,
        },
      })
    }
    logJobEvent({
      jobId: String(job.id),
      workspaceId,
      connectorId,
      stage: 'connector.sync',
      status: 'completed',
      rowsProcessed: result.rowsSynced,
    })
  },
  { connection, concurrency: Number(process.env.CONNECTOR_SYNC_CONCURRENCY ?? 2) }
)

worker.on('failed', async (job, error) => {
  if (!job) return
  const connectorId = String((job.data as { connectorId?: string }).connectorId ?? '')
  if (!connectorId) return
  const syncJobId = String((job.data as { syncJobId?: string }).syncJobId ?? '')
  await prisma.connector.updateMany({
    where: { id: connectorId },
    data: { status: 'ERROR', lastError: error.message },
  })
  logError('connector.worker.failed', {
    job_id: String(job.id),
    connector_id: connectorId,
    error_message: error.message,
  })
  if (syncJobId) {
    const existing = await prisma.connectorSyncJob.findUnique({ where: { id: syncJobId } })
    if (existing) {
      const nextAttempts = existing.attempts
      await prisma.connectorSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: nextAttempts >= existing.maxAttempts ? 'DEAD_LETTER' : 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
          deadLetterReason: nextAttempts >= existing.maxAttempts ? 'Exceeded max attempts' : null,
        },
      })
    }
  }
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
