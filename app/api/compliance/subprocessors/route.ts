import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subprocessors = await prisma.subprocessor.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ subprocessors })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:compliance')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as { name?: string; purpose?: string; region?: string; website?: string; active?: boolean }
  const name = (body.name ?? '').trim()
  const purpose = (body.purpose ?? '').trim()
  if (!name || !purpose) return NextResponse.json({ error: 'name and purpose are required' }, { status: 400 })
  const subprocessor = await prisma.subprocessor.create({
    data: {
      workspaceId: auth.workspaceId,
      name,
      purpose,
      region: body.region?.trim() || null,
      website: body.website?.trim() || null,
      active: body.active ?? true,
    },
  })
  return NextResponse.json({ subprocessor }, { status: 201 })
}
