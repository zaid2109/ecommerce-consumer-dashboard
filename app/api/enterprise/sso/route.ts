import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sso')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const configs = await prisma.ssoConfig.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ configs })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:sso')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as {
    providerType?: 'SAML' | 'OIDC'
    issuer?: string
    entryPoint?: string
    clientId?: string
    clientSecret?: string
    metadataUrl?: string
    enabled?: boolean
  }
  const providerType = body.providerType === 'SAML' ? 'SAML' : 'OIDC'
  const config = await prisma.ssoConfig.create({
    data: {
      workspaceId: auth.workspaceId,
      providerType,
      issuer: body.issuer?.trim() || null,
      entryPoint: body.entryPoint?.trim() || null,
      clientId: body.clientId?.trim() || null,
      clientSecret: body.clientSecret?.trim() || null,
      metadataUrl: body.metadataUrl?.trim() || null,
      enabled: body.enabled ?? false,
    },
  })
  return NextResponse.json({ config }, { status: 201 })
}
