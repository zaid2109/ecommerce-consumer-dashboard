import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { workspaceId?: string; email?: string }
  const workspaceId = (body.workspaceId ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  if (!workspaceId || !email) {
    return NextResponse.json({ error: 'workspaceId and email are required' }, { status: 400 })
  }
  const config = await prisma.ssoConfig.findFirst({
    where: { workspaceId, enabled: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!config) return NextResponse.json({ error: 'SSO is not configured' }, { status: 404 })

  const challenge = `${config.providerType}:${workspaceId}:${Buffer.from(email).toString('base64url')}`
  return NextResponse.json({
    provider: config.providerType,
    loginUrl:
      config.providerType === 'SAML'
        ? `${config.entryPoint ?? ''}?SAMLRequest=${encodeURIComponent(challenge)}`
        : `${config.entryPoint ?? ''}?client_id=${encodeURIComponent(config.clientId ?? '')}&login_hint=${encodeURIComponent(email)}&state=${encodeURIComponent(challenge)}`,
  })
}
