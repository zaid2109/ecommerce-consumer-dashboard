import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { readJsonArtifact } from '@/lib/server/artifact-store'
import { toRejectCsv } from '@/lib/server/data-quality'

export const runtime = 'nodejs'

type StoredDatasetPayload = {
  rejectRows?: Array<Record<string, unknown> & { __reject_reason: string }>
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dataset = await prisma.dataset.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
    select: { id: true, s3ProcessedKey: true },
  })
  if (!dataset || !dataset.s3ProcessedKey) {
    return NextResponse.json({ error: 'Dataset or processed artifact not found' }, { status: 404 })
  }

  const artifact = await readJsonArtifact<StoredDatasetPayload>(dataset.s3ProcessedKey)
  const rejectRows = artifact?.rejectRows ?? []
  const csv = toRejectCsv(rejectRows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="dataset-${dataset.id}-rejects.csv"`,
    },
  })
}
