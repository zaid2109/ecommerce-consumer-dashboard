import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { getIngestionQueue } from '@/lib/server/queue'
import { enforceCsrf } from '@/lib/server/security'
import { checkPlanLimit } from '@/lib/server/plan-limits'
import { createRequestLogContext, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const requestLog = createRequestLogContext({ req })
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    requestLog.finish(401)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const datasets = await prisma.dataset.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
    select: {
      id: true,
      name: true,
      sourceType: true,
      status: true,
      rowCount: true,
      columnCount: true,
      s3ProcessedKey: true,
      createdAt: true,
      version: true,
    },
    take: 20,
  })

  requestLog.finish(200, { workspace_id: auth.workspaceId, user_id: auth.userId })
  return NextResponse.json({ datasets })
}

export async function POST(req: NextRequest) {
  const requestLog = createRequestLogContext({ req })
  const csrfError = enforceCsrf(req)
  if (csrfError) {
    requestLog.finish(403)
    return csrfError
  }

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    requestLog.finish(401)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    sourceType?: string
    rowCount?: number
    columnCount?: number
    schema?: unknown
    idempotencyKey?: string
    rawArtifactKey?: string
    processedArtifactKey?: string
    processedMetrics?: unknown
  }

  const name = (body.name ?? 'Uploaded Dataset').trim()
  const sourceType = (body.sourceType ?? 'UPLOAD').trim()
  const idempotencyKey = (body.idempotencyKey ?? '').trim()
  if (!idempotencyKey) {
    requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
    return NextResponse.json({ error: 'Missing idempotency key' }, { status: 400 })
  }

  const rowsToAdd = Math.max(0, body.rowCount ?? 0)
  const planCheck = await checkPlanLimit({
    workspaceId: auth.workspaceId,
    metric: 'monthlyRows',
    increment: rowsToAdd,
  })
  if (!planCheck.ok) {
    requestLog.finish(403, { workspace_id: auth.workspaceId, user_id: auth.userId })
    return NextResponse.json({ error: planCheck.message }, { status: 403 })
  }

  const { dataset, job, createdNew } = await prisma.$transaction(async (tx) => {
    const existingJob = await tx.ingestionJob.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: auth.workspaceId,
          idempotencyKey,
        },
      },
      include: {
        dataset: true,
      },
    })
    if (existingJob?.dataset) {
      return { dataset: existingJob.dataset, job: existingJob, createdNew: false }
    }

    const latest = await tx.dataset.findFirst({
      where: { workspaceId: auth.workspaceId, name },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (latest?.version ?? 0) + 1

    const createdDataset = await tx.dataset.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        sourceType,
        status: 'PENDING',
        rowCount: body.rowCount ?? 0,
        columnCount: body.columnCount ?? 0,
        schema: {
          ...(typeof body.schema === 'object' && body.schema !== null ? (body.schema as Record<string, unknown>) : {}),
          processedMetrics: body.processedMetrics ?? null,
        },
        s3RawKey: body.rawArtifactKey ?? null,
        s3ProcessedKey: body.processedArtifactKey ?? null,
        createdById: auth.userId,
        version: nextVersion,
      },
    })

    const createdJob = await tx.ingestionJob.create({
      data: {
        datasetId: createdDataset.id,
        workspaceId: auth.workspaceId,
        status: 'QUEUED',
        idempotencyKey,
        metadata: { createdVia: 'upload' },
      },
    })

    return { dataset: createdDataset, job: createdJob, createdNew: true }
  })

  try {
    if (!createdNew) {
      requestLog.finish(200, { workspace_id: auth.workspaceId, user_id: auth.userId, idempotent_replay: true })
      return NextResponse.json({ dataset, job, idempotentReplay: true }, { status: 200 })
    }

    const queue = getIngestionQueue()
    if (queue) {
      await queue.add(
        'ingest-dataset',
        { datasetId: dataset.id, workspaceId: auth.workspaceId },
        { jobId: job.id }
      )
    } else {
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: 'Ingestion queue unavailable',
          metadata: { progress: 0, mode: 'queue-unavailable' },
        },
      })
      await prisma.dataset.update({
        where: { id: dataset.id },
        data: { status: 'FAILED' },
      })
      requestLog.finish(503, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'Ingestion queue unavailable', dataset, jobId: job.id }, { status: 503 })
    }
  } catch (error) {
    logError('queue.enqueue.error', {
      request_id: requestLog.requestId,
      workspace_id: auth.workspaceId,
      user_id: auth.userId,
      error_message: error instanceof Error ? error.message : String(error),
    })
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    })
    await prisma.dataset.update({
      where: { id: dataset.id },
      data: { status: 'FAILED' },
    })
    requestLog.finish(500, { workspace_id: auth.workspaceId, user_id: auth.userId })
    return NextResponse.json({ error: 'Failed to enqueue ingestion job' }, { status: 500 })
  }

  requestLog.finish(201, { workspace_id: auth.workspaceId, user_id: auth.userId })
  return NextResponse.json({ dataset, job }, { status: 201 })
}
