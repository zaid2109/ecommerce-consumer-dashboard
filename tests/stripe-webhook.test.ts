import { describe, expect, it } from 'vitest'
import crypto from 'crypto'
import { verifyStripeWebhookSignature } from '@/lib/server/stripe-webhook'

function makeSignature(rawBody: string, secret: string, timestamp: string): string {
  const signed = `${timestamp}.${rawBody}`
  const digest = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex')
  return `t=${timestamp},v1=${digest}`
}

describe('stripe webhook signature verification', () => {
  it('accepts a valid signature', () => {
    const rawBody = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' })
    const secret = 'whsec_test_secret'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const header = makeSignature(rawBody, secret, timestamp)

    const ok = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: header,
      signingSecret: secret,
    })
    expect(ok).toBe(true)
  })

  it('rejects invalid signatures', () => {
    const rawBody = JSON.stringify({ id: 'evt_2' })
    const secret = 'whsec_test_secret'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const header = makeSignature(rawBody, 'wrong_secret', timestamp)

    const ok = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: header,
      signingSecret: secret,
    })
    expect(ok).toBe(false)
  })
})
