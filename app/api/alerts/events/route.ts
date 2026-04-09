import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:read')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const events = await prisma.alertEvent.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { breachedAt: 'desc' },
    take: 50,
    include: { rule: { select: { id: true, name: true, metric: true, channels: true } } },
  })

  return NextResponse.json({ events })
}
