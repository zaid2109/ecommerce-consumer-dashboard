import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const pagePath = (url.searchParams.get('page') ?? '/dashboard').trim()

  const views = await prisma.savedView.findMany({
    where: {
      workspaceId: auth.workspaceId,
      pagePath,
      OR: [{ visibility: 'TEAM' }, { createdById: auth.userId }],
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
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

  return NextResponse.json({ views })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    pagePath?: string
    visibility?: 'PRIVATE' | 'TEAM'
    filters?: unknown
    isPinned?: boolean
  }

  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const pagePath = (body.pagePath ?? '/dashboard').trim()
  const visibility = body.visibility === 'TEAM' ? 'TEAM' : 'PRIVATE'
  const filters = typeof body.filters === 'object' && body.filters !== null ? body.filters : {}
  const shareToken = crypto.randomBytes(18).toString('base64url')

  const view = await prisma.savedView.create({
    data: {
      workspaceId: auth.workspaceId,
      createdById: auth.userId,
      name,
      pagePath,
      visibility,
      isPinned: Boolean(body.isPinned),
      filters: filters as object,
      shareToken,
    },
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

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'saved_view.create',
      resourceType: 'saved_view',
      resourceId: view.id,
      metadata: { pagePath, visibility, isPinned: view.isPinned },
    },
  })

  return NextResponse.json({ view }, { status: 201 })
}
