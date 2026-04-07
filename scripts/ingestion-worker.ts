import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '@/lib/server/prisma'
import { logError, logJobEvent } from '@/lib/server/logger'
import { readJsonArtifact, writeJsonArtifact } from '@/lib/server/artifact-store'
import { transformDataset } from '@/lib/dataset-transformer'
import { normalizeColumnMapping } from '@/lib/column-mapper'
import type { ColumnMapping } from '@/lib/dataset-store'
import type { Prisma } from '@prisma/client'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const worker = new Worker(
  'ingestion-jobs',
  async (job) => {
    const { datasetId, workspaceId } = job.data as {
      datasetId: string
      workspaceId: string
    }

    logJobEvent({
      jobId: String(job.id),
      datasetId,
      workspaceId,
      stage: 'ingestion',
      status: 'processing',
      rowsProcessed: 0,
    })

    await prisma.ingestionJob.updateMany({
      where: { id: job.id, workspaceId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    })
    await prisma.dataset.updateMany({
      where: { id: datasetId, workspaceId },
      data: { status: 'PROCESSING' },
    })

    await job.updateProgress(20)
    logJobEvent({
      jobId: String(job.id),
      datasetId,
      workspaceId,
      stage: 'ingestion.parse',
      status: 'processing',
      rowsProcessed: 20,
    })

    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, workspaceId },
      select: {
        id: true,
        rowCount: true,
        schema: true,
        s3RawKey: true,
        s3ProcessedKey: true,
      },
    })
    if (!dataset) {
      throw new Error('Dataset not found for ingestion job')
    }
    if (!dataset.s3RawKey || !dataset.s3ProcessedKey) {
      throw new Error('Dataset artifact keys are missing')
    }

    const rawArtifact = await readJsonArtifact<{ rows?: Record<string, unknown>[]; columns?: string[] }>(dataset.s3RawKey)
    if (!rawArtifact || !Array.isArray(rawArtifact.rows)) {
      throw new Error('Raw uploaded artifact is missing or invalid')
    }
    const availableColumns = Array.isArray(rawArtifact.columns)
      ? rawArtifact.columns.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : []

    const schema = (dataset.schema && typeof dataset.schema === 'object' ? dataset.schema : {}) as {
      columnMapping?: Partial<Record<keyof ColumnMapping, string | null>>
      processedMetrics?: { dateFormat?: string | null }
    }
    const mapping = normalizeColumnMapping(schema.columnMapping ?? {}, availableColumns)

    await job.updateProgress(55)
    logJobEvent({
      jobId: String(job.id),
      datasetId,
      workspaceId,
      stage: 'ingestion.transform',
      status: 'processing',
      rowsProcessed: 55,
    })

    const transformed = transformDataset({
      rows: rawArtifact.rows,
      mapping,
      dateFormat: schema.processedMetrics?.dateFormat ?? null,
    })

    await writeJsonArtifact(dataset.s3ProcessedKey, {
      orders: transformed.orders,
      aggregated: transformed.aggregated,
    })

    const updatedMetrics = {
      ...(schema.processedMetrics ?? {}),
      transformedRowCount: transformed.orders.length,
      transformedAt: new Date().toISOString(),
    }

    const nextSchema = {
      ...schema,
      columnMapping: mapping as unknown as Record<string, string | null>,
      processedMetrics: updatedMetrics,
    } as unknown as Prisma.InputJsonValue

    await prisma.dataset.updateMany({
      where: { id: datasetId, workspaceId },
      data: {
        rowCount: transformed.orders.length,
        columnCount: availableColumns.length,
        schema: nextSchema,
      },
    })

    await job.updateProgress(100)

    await prisma.ingestionJob.updateMany({
      where: { id: job.id, workspaceId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: { progress: 100, message: 'Ingestion completed' },
      },
    })
    await prisma.dataset.updateMany({
      where: { id: datasetId, workspaceId },
      data: { status: 'READY' },
    })
    logJobEvent({
      jobId: String(job.id),
      datasetId,
      workspaceId,
      stage: 'ingestion',
      status: 'completed',
      rowsProcessed: 100,
    })
  },
  { connection, concurrency: Number(process.env.INGESTION_CONCURRENCY ?? 2) }
)

worker.on('failed', async (job, error) => {
  if (!job) return
  const workspaceId = String((job.data as { workspaceId?: string }).workspaceId ?? '')
  await prisma.ingestionJob.updateMany({
    where: { id: job.id, workspaceId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error.message,
      retryCount: job.attemptsMade,
    },
  })
  logError('ingestion.worker.failed', {
    job_id: String(job.id),
    workspace_id: workspaceId,
    error_message: error.message,
  })
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
