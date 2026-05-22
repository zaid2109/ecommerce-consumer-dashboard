import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { verifyStripeWebhookSignature } from '@/lib/server/stripe-webhook'

export const runtime = 'nodejs'

// Real Stripe event envelope — https://stripe.com/docs/api/events/object
type StripeEvent = {
  id: string
  type: string
  data: {
    object: {
      id: string
      customer?: string
      status?: string
      current_period_end?: number
      metadata?: Record<string, string>
    }
  }
}

// Maps Stripe's lowercase status to our enum.
function toSubscriptionStatus(stripeStatus: string | undefined): 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | null {
  switch (stripeStatus) {
    case 'trialing': return 'TRIALING'
    case 'active': return 'ACTIVE'
    case 'past_due': return 'PAST_DUE'
    case 'canceled': return 'CANCELED'
    default: return null
  }
}

function toPlan(raw: string | undefined): 'STARTER' | 'GROWTH' | 'ENTERPRISE' | null {
  switch (raw?.toUpperCase()) {
    case 'STARTER': return 'STARTER'
    case 'GROWTH': return 'GROWTH'
    case 'ENTERPRISE': return 'ENTERPRISE'
    default: return null
  }
}

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

  const body = JSON.parse(rawBody) as StripeEvent
  const providerEventId = (body.id ?? '').trim()
  const eventType = (body.type ?? '').trim()

  if (!providerEventId) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (!eventType) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  // Idempotency — skip events we have already processed.
  const existing = await prisma.billingEvent.findFirst({
    where: { provider: 'stripe', providerEventId },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ ok: true, replay: true })
  }

  // Resolve workspaceId from subscription metadata (standard Stripe pattern).
  const subscriptionObj = body.data?.object
  const workspaceId = (
    subscriptionObj?.metadata?.workspaceId ?? ''
  ).trim()

  if (!workspaceId) {
    // Accept the event so Stripe stops retrying, but do nothing.
    return NextResponse.json({ ok: true, skipped: 'no workspaceId in metadata' })
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
    const newStatus = toSubscriptionStatus(subscriptionObj?.status)
    const newPlan = toPlan(subscriptionObj?.metadata?.plan)
    const newPeriodEnd = subscriptionObj?.current_period_end
      ? new Date(subscriptionObj.current_period_end * 1000)
      : undefined

    const current = await prisma.subscription.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })

    if (current) {
      await prisma.subscription.update({
        where: { id: current.id },
        data: {
          externalId: subscriptionObj?.id ?? current.externalId,
          ...(newStatus ? { status: newStatus } : {}),
          ...(newPlan ? { plan: newPlan } : {}),
          ...(newPeriodEnd ? { currentPeriodEnd: newPeriodEnd } : {}),
        },
      })
      if (newPlan) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { plan: newPlan },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
