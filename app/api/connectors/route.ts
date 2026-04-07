import { NextRequest, NextResponse } from 'next/server'
import type { ConnectorType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { encryptConnectorConfig } from '@/lib/server/connector-secrets'
import { enforceCsrf } from '@/lib/server/security'
import { checkPlanLimit } from '@/lib/server/plan-limits'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connectors = await prisma.connector.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    connectors: connectors.map((connector) => ({
      id: connector.id,
      workspaceId: connector.workspaceId,
      type: connector.type,
      status: connector.status,
      displayName: connector.displayName,
      lastSyncAt: connector.lastSyncAt,
      rowsSynced: connector.rowsSynced,
      lastError: connector.lastError,
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    type?: ConnectorType
    displayName?: string
    config?: Record<string, unknown>
  }
  const config = (body.config ?? {}) as Record<string, unknown>
  const type = body.type
  if (!type) {
    return NextResponse.json({ error: 'Connector type is required' }, { status: 400 })
  }

  const existingConnector = await prisma.connector.findFirst({
    where: { workspaceId: auth.workspaceId, type },
    select: { id: true },
  })
  if (!existingConnector) {
    const planCheck = await checkPlanLimit({
      workspaceId: auth.workspaceId,
      metric: 'connectors',
      increment: 1,
    })
    if (!planCheck.ok) {
      return NextResponse.json({ error: planCheck.message }, { status: 403 })
    }
  }
  const encryptedConfig = encryptConnectorConfig(config)

  const connector = await prisma.connector.upsert({
    where: {
      workspaceId_type: {
        workspaceId: auth.workspaceId,
        type,
      },
    },
    update: {
      status: 'CONNECTED',
      displayName: body.displayName ?? type,
      config: encryptedConfig,
      lastError: null,
    },
    create: {
      workspaceId: auth.workspaceId,
      type,
      status: 'CONNECTED',
      displayName: body.displayName ?? type,
      config: encryptedConfig,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'connector.connect',
      resourceType: 'connector',
      resourceId: connector.id,
      metadata: { type } as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ connector }, { status: 201 })
}
