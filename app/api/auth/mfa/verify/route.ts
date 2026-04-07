import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { verifyTotpCode } from '@/lib/server/mfa'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { code?: string }
  const code = (body.code ?? '').trim()
  if (!code) {
    return NextResponse.json({ error: 'MFA code is required' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { id: auth.userId, workspaceId: auth.workspaceId },
    select: { id: true, mfaSecret: true },
  })
  if (!user || !user.mfaSecret) {
    return NextResponse.json({ error: 'MFA setup not found' }, { status: 404 })
  }

  const ok = verifyTotpCode({ secret: user.mfaSecret, code })
  if (!ok) {
    return NextResponse.json({ error: 'Invalid MFA code' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  })
  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.mfa.verify',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { verified: true },
    },
  })

  return NextResponse.json({ ok: true })
}

