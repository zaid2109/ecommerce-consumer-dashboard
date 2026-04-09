import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { readJsonArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'

type StoredExportPayload = {
  format?: 'CSV' | 'XLSX' | 'PDF'
  content?: string
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

  const artifact = await readJsonArtifact<StoredExportPayload>(job.artifactKey)
  if (!artifact?.content) {
    return NextResponse.json({ error: 'Export artifact missing' }, { status: 404 })
  }

  const ext = job.format === 'XLSX' ? 'csv' : job.format === 'PDF' ? 'txt' : 'csv'
  const contentType = ext === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8'
  return new NextResponse(artifact.content, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="export-${job.id}.${ext}"`,
    },
  })
}
