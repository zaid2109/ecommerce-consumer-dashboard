import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { getIngestionQueue } from '@/lib/server/queue'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await prisma.exportJob.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    datasetId?: string
    format?: 'CSV' | 'XLSX' | 'PDF'
    scheduleCron?: string | null
    payload?: unknown
  }
  const format = body.format === 'XLSX' || body.format === 'PDF' ? body.format : 'CSV'

  const job = await prisma.exportJob.create({
    data: {
      workspaceId: auth.workspaceId,
      createdById: auth.userId,
      datasetId: body.datasetId ?? null,
      format,
      scheduleCron: body.scheduleCron?.trim() || null,
      payload: typeof body.payload === 'object' && body.payload !== null ? (body.payload as object) : {},
      auditMetadata: { requestedBy: auth.userId },
    },
  })

  const queue = getIngestionQueue()
  if (!queue) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: 'Export queue unavailable', completedAt: new Date() },
    })
    return NextResponse.json({ error: 'Export queue unavailable' }, { status: 503 })
  }

  await queue.add(
    'export-dataset',
    {
      exportJobId: job.id,
      workspaceId: auth.workspaceId,
      datasetId: body.datasetId ?? null,
      format,
    },
    { jobId: `export-${job.id}` }
  )

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'export_job.create',
      resourceType: 'export_job',
      resourceId: job.id,
      metadata: { format, scheduled: Boolean(body.scheduleCron) },
    },
  })

  return NextResponse.json({ job }, { status: 201 })
}
