import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
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

  const connector = await prisma.connector.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
  })
  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
  }

  const allowed = await allowAction({
    key: `${auth.workspaceId}:${auth.userId}:connector:${connector.id}`,
    action: 'connector-manual-sync',
    limit: 20,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  const syncJob = await prisma.connectorSyncJob.create({
    data: {
      connectorId: connector.id,
      workspaceId: auth.workspaceId,
      trigger: 'MANUAL',
      status: 'PROCESSING',
      attempts: 1,
      maxAttempts: Number(process.env.CONNECTOR_SYNC_MAX_ATTEMPTS ?? 3),
      startedAt: new Date(),
    },
  })

  try {
    const result = await runConnectorSync(connector.type, decryptConnectorConfig(connector.config))
    const updated = await prisma.connector.update({
      where: { id: connector.id },
      data: {
        status: 'CONNECTED',
        rowsSynced: connector.rowsSynced + result.rowsSynced,
        lastSyncAt: new Date(),
        lastError: null,
      },
    })
    const metadata = result.metadata as Prisma.InputJsonValue

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        action: 'connector.sync',
        resourceType: 'connector',
        resourceId: connector.id,
        metadata,
      },
    })
    await prisma.connectorSyncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata,
      },
    })

    return NextResponse.json({ connector: updated, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    await prisma.connector.update({
      where: { id: connector.id },
      data: { status: 'ERROR', lastError: message },
    })
    await prisma.connectorSyncJob.update({
      where: { id: syncJob.id },
      data: {
        status: syncJob.attempts >= syncJob.maxAttempts ? 'DEAD_LETTER' : 'FAILED',
        completedAt: new Date(),
        errorMessage: message,
      },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
