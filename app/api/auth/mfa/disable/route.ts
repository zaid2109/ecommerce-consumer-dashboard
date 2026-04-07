import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: { id: auth.userId, workspaceId: auth.workspaceId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
    },
  })
  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.mfa.disable',
      resourceType: 'user',
      resourceId: user.id,
      metadata: {},
    },
  })

  return NextResponse.json({ ok: true })
}

