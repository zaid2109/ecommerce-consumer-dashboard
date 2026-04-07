import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deleted = await prisma.session.deleteMany({
    where: { id: params.id, userId: auth.userId },
  })
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.session.revoke_one',
      resourceType: 'session',
      resourceId: params.id,
      metadata: {},
    },
  })

  return NextResponse.json({ ok: true })
}

