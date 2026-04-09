import crypto from 'crypto'

function parseStripeHeader(signatureHeader: string): { timestamp: string; signatures: string[] } | null {
  const entries = signatureHeader
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('='))
    .filter((pair): pair is [string, string] => pair.length === 2)

  const timestamp = entries.find(([k]) => k === 't')?.[1] ?? ''
  const signatures = entries.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!timestamp || signatures.length === 0) return null
  return { timestamp, signatures }
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string
  signatureHeader: string | null
  signingSecret: string
  toleranceSeconds?: number
}): boolean {
  if (!input.signatureHeader) return false
  const parsed = parseStripeHeader(input.signatureHeader)
  if (!parsed) return false

  const tolerance = input.toleranceSeconds ?? 300
  const timestampMs = Number(parsed.timestamp) * 1000
  if (!Number.isFinite(timestampMs)) return false
  if (Math.abs(Date.now() - timestampMs) > tolerance * 1000) return false

  const signedPayload = `${parsed.timestamp}.${input.rawBody}`
  const expected = crypto
    .createHmac('sha256', input.signingSecret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  return parsed.signatures.some((sig) => {
    try {
      const a = Buffer.from(sig, 'hex')
      const b = Buffer.from(expected, 'hex')
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  })
}
