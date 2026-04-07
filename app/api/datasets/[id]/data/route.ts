import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { readJsonArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'

type StoredDatasetPayload = {
  orders: unknown[]
  aggregated: unknown
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
    select: { id: true, status: true, s3ProcessedKey: true },
  })
  if (!dataset) {
    return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
  }
  if (!dataset.s3ProcessedKey) {
    return NextResponse.json({ error: 'Processed dataset artifact not available yet' }, { status: 409 })
  }

  const artifact = await readJsonArtifact<StoredDatasetPayload>(dataset.s3ProcessedKey)
  if (!artifact || !Array.isArray(artifact.orders) || !artifact.aggregated) {
    return NextResponse.json({ error: 'Processed dataset artifact missing or invalid' }, { status: 404 })
  }

  return NextResponse.json({
    datasetId: dataset.id,
    status: dataset.status,
    orders: artifact.orders,
    aggregated: artifact.aggregated,
  })
}

