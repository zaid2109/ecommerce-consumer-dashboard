import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.alertEvent.findFirst({
    where: { id: params.id, workspaceId: auth.workspaceId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const event = await prisma.alertEvent.update({
    where: { id: params.id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedById: auth.userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'alert_event.ack',
      resourceType: 'alert_event',
      resourceId: event.id,
      metadata: {},
    },
  })

  return NextResponse.json({ event })
}
