import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.savedView.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.createdById !== auth.userId && auth.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as {
    name?: string
    visibility?: 'PRIVATE' | 'TEAM'
    isPinned?: boolean
    filters?: unknown
  }

  const data: {
    name?: string
    visibility?: 'PRIVATE' | 'TEAM'
    isPinned?: boolean
    filters?: object
  } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (body.visibility === 'PRIVATE' || body.visibility === 'TEAM') data.visibility = body.visibility
  if (typeof body.isPinned === 'boolean') data.isPinned = body.isPinned
  if (typeof body.filters === 'object' && body.filters !== null) data.filters = body.filters as object

  const updated = await prisma.savedView.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      name: true,
      pagePath: true,
      visibility: true,
      isPinned: true,
      shareToken: true,
      filters: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
    },
  })

  return NextResponse.json({ view: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.savedView.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.createdById !== auth.userId && auth.role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.savedView.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
