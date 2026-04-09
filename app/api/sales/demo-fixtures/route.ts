import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sales')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const fixtures = await prisma.demoFixture.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ fixtures })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sales')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { name?: string; description?: string; datasetId?: string }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const fixture = await prisma.demoFixture.create({
    data: {
      workspaceId: auth.workspaceId,
      name,
      description: body.description?.trim() || null,
      datasetId: body.datasetId?.trim() || null,
    },
  })
  return NextResponse.json({ fixture }, { status: 201 })
}
