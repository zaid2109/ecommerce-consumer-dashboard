import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { generateBackupCodes, generateTotpSecret, getTotpUri } from '@/lib/server/mfa'

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
    select: { id: true, email: true, mfaEnabled: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const secret = generateTotpSecret()
  const backupCodes = await generateBackupCodes(8)
  const otpauthUrl = getTotpUri({
    secret,
    email: user.email,
    issuer: process.env.MFA_ISSUER_NAME ?? 'EcoDash',
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaSecret: secret,
      mfaBackupCodes: backupCodes.hashed,
      mfaEnabled: false,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: 'auth.mfa.setup',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { mfaEnabled: true },
    },
  })

  return NextResponse.json({
    secret,
    otpauthUrl,
    backupCodes: backupCodes.plain,
  })
}

