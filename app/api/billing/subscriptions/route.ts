import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:billing')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subscriptions = await prisma.subscription.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ subscriptions })
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError
  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'admin:billing')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json()) as {
    externalId?: string
    plan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE'
    status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    trialDays?: number
    currentPeriodDays?: number
  }
  const trialDays = Math.max(0, body.trialDays ?? 14)
  const currentPeriodDays = Math.max(1, body.currentPeriodDays ?? 30)

  const subscription = await prisma.subscription.create({
    data: {
      workspaceId: auth.workspaceId,
      externalId: body.externalId?.trim() || null,
      plan: body.plan ?? 'STARTER',
      status: body.status ?? 'TRIALING',
      trialEndsAt: new Date(Date.now() + trialDays * 86400000),
      currentPeriodEnd: new Date(Date.now() + currentPeriodDays * 86400000),
    },
  })

  await prisma.workspace.update({
    where: { id: auth.workspaceId },
    data: { plan: subscription.plan },
  })

  await prisma.billingEvent.create({
    data: {
      workspaceId: auth.workspaceId,
      provider: 'stripe',
      providerEventId: `manual-subscription-${subscription.id}`,
      eventType: 'subscription.created',
      payload: subscription,
    },
  })

  return NextResponse.json({ subscription }, { status: 201 })
}
