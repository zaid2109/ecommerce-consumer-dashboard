import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { getConnectorSyncQueue } from '@/lib/server/connector-queue'
import { runConnectorSync } from '@/lib/server/connectors'
import { allowAction } from '@/lib/server/rate-limit'
import { enforceCsrf } from '@/lib/server/security'
import { decryptConnectorConfig } from '@/lib/server/connector-secrets'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await allowAction({
    key: `${auth.workspaceId}:${auth.userId}:job:${params.id}`,
    action: 'connector-retry',
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  const failedJob = await prisma.connectorSyncJob.findFirst({
    where: {
      id: params.id,
      workspaceId: auth.workspaceId,
      status: { in: ['FAILED', 'DEAD_LETTER'] },
    },
    select: {
      id: true,
      connectorId: true,
      attempts: true,
      maxAttempts: true,
    },
  })
  if (!failedJob) {
    return NextResponse.json({ error: 'Retryable sync job not found' }, { status: 404 })
  }

  if (failedJob.attempts >= failedJob.maxAttempts + 2) {
    return NextResponse.json({ error: 'Retry limit exceeded for this job' }, { status: 400 })
  }

  const queue = getConnectorSyncQueue()
  if (queue) {
    await prisma.connectorSyncJob.update({
      where: { id: failedJob.id },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        deadLetterReason: null,
      },
    })
    await queue.add(
      'connector-sync',
      {
        connectorId: failedJob.connectorId,
        workspaceId: auth.workspaceId,
        syncJobId: failedJob.id,
      },
      { jobId: failedJob.id }
    )
    return NextResponse.json({ retried: true, mode: 'queue', id: failedJob.id })
  }

  const connector = await prisma.connector.findFirst({
    where: { id: failedJob.connectorId, workspaceId: auth.workspaceId },
  })
  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
  }

  try {
    await prisma.connectorSyncJob.update({
      where: { id: failedJob.id },
      data: {
        status: 'PROCESSING',
        attempts: failedJob.attempts + 1,
        trigger: 'RETRY',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        deadLetterReason: null,
      },
    })
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
    await prisma.connectorSyncJob.update({
      where: { id: failedJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })
    return NextResponse.json({ retried: true, mode: 'inline-no-queue', id: failedJob.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Retry failed'
    const current = await prisma.connectorSyncJob.findUnique({ where: { id: failedJob.id } })
    await prisma.connectorSyncJob.update({
      where: { id: failedJob.id },
      data: {
        status: (current && current.attempts >= current.maxAttempts) ? 'DEAD_LETTER' : 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
        deadLetterReason: (current && current.attempts >= current.maxAttempts) ? 'Exceeded max attempts' : null,
      },
    })
    await prisma.connector.update({
      where: { id: connector.id },
      data: { status: 'ERROR', lastError: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
