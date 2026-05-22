import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { readJsonArtifact, readBinaryArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'

type StoredExportPayload = {
  format?: 'CSV' | 'XLSX' | 'PDF'
  content?: string
  note?: string
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await prisma.exportJob.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
    select: { id: true, status: true, artifactKey: true, format: true },
  })
  if (!job) return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
  if (job.status !== 'COMPLETED' || !job.artifactKey) {
    return NextResponse.json({ error: 'Export artifact not ready' }, { status: 409 })
  }

  // XLSX artifacts are stored as binary blobs, not JSON.
  if (job.format === 'XLSX') {
    const buffer = await readBinaryArtifact(job.artifactKey)
    if (!buffer) return NextResponse.json({ error: 'Export artifact missing' }, { status: 404 })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="export-${job.id}.xlsx"`,
      },
    })
  }

  const artifact = await readJsonArtifact<StoredExportPayload>(job.artifactKey)
  if (!artifact?.content) {
    return NextResponse.json({ error: 'Export artifact missing' }, { status: 404 })
  }

  const ext = job.format === 'PDF' ? 'csv' : 'csv'
  const contentType = 'text/csv; charset=utf-8'
  return new NextResponse(artifact.content, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="export-${job.id}.${ext}"`,
    },
  })
}
