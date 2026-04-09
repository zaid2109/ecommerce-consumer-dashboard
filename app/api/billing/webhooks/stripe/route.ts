import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { verifyStripeWebhookSignature } from '@/lib/server/stripe-webhook'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 503 })
  }

  const signatureHeader = req.headers.get('stripe-signature')
  const rawBody = await req.text()
  const signatureOk = verifyStripeWebhookSignature({
    rawBody,
    signatureHeader,
    signingSecret: secret,
  })
  if (!signatureOk) {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  const body = JSON.parse(rawBody) as {
    id?: string
    workspaceId?: string
    type?: string
    data?: {
      id?: string
      plan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE'
      status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
      currentPeriodEnd?: string
      overageRows?: number
    }
  }

  const workspaceId = (body.workspaceId ?? '').trim()
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  const eventType = (body.type ?? '').trim()
  if (!eventType) return NextResponse.json({ error: 'type is required' }, { status: 400 })
  const providerEventId = (body.id ?? '').trim() || null
  if (!providerEventId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.billingEvent.findFirst({
    where: {
      provider: 'stripe',
      providerEventId,
    },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ ok: true, replay: true })
  }

  await prisma.billingEvent.create({
    data: {
      workspaceId,
      provider: 'stripe',
      providerEventId,
      eventType,
      payload: body as object,
    },
  })

  if (eventType.startsWith('customer.subscription')) {
    const current = await prisma.subscription.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    if (current) {
      await prisma.subscription.update({
        where: { id: current.id },
        data: {
          externalId: body.data?.id ?? current.externalId,
          plan: body.data?.plan ?? current.plan,
          status: body.data?.status ?? current.status,
          currentPeriodEnd: body.data?.currentPeriodEnd ? new Date(body.data.currentPeriodEnd) : current.currentPeriodEnd,
          overageRows: typeof body.data?.overageRows === 'number' ? body.data.overageRows : current.overageRows,
        },
      })
      if (body.data?.plan) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { plan: body.data.plan },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
