import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const view = await prisma.savedView.findFirst({
    where: {
      workspaceId: auth.workspaceId,
      shareToken: params.token,
      OR: [{ visibility: 'TEAM' }, { createdById: auth.userId }],
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
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ view })
}
