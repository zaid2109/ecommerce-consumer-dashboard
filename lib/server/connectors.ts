import type { ConnectorType } from '@prisma/client'

export type ConnectorSyncResult = {
  rowsSynced: number
  metadata: Record<string, unknown>
}

function asString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

async function syncShopify(config: Record<string, unknown>): Promise<ConnectorSyncResult> {
  const shopDomain = asString(config.shopDomain || config.shop || config.store)
  const accessToken = asString(config.accessToken || config.token)
  if (!shopDomain || !accessToken) {
    throw new Error('Shopify connector requires shopDomain and accessToken')
  }

  const ordersUrl = `https://${shopDomain}/admin/api/2024-01/orders.json?limit=250&status=any`
  const res = await fetch(ordersUrl, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })
  if (!res.ok) {
    throw new Error(`Shopify sync failed (${res.status})`)
  }
  const payload = (await res.json()) as { orders?: unknown[] }
  const orders = Array.isArray(payload.orders) ? payload.orders : []
  return {
    rowsSynced: orders.length,
    metadata: { source: 'shopify', endpoint: 'orders', syncedEntities: ['orders'] },
  }
}

async function syncStripe(config: Record<string, unknown>): Promise<ConnectorSyncResult> {
  const secretKey = asString(config.secretKey || config.apiKey || config.token)
  if (!secretKey) {
    throw new Error('Stripe connector requires secretKey')
  }

  const res = await fetch('https://api.stripe.com/v1/charges?limit=100', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) {
    throw new Error(`Stripe sync failed (${res.status})`)
  }
  const payload = (await res.json()) as { data?: unknown[] }
  const charges = Array.isArray(payload.data) ? payload.data : []
  return {
    rowsSynced: charges.length,
    metadata: { source: 'stripe', endpoint: 'charges', syncedEntities: ['charges'] },
  }
}

async function syncGa4(config: Record<string, unknown>): Promise<ConnectorSyncResult> {
  const propertyId = asString(config.propertyId)
  const accessToken = asString(config.accessToken || config.token)
  if (!propertyId || !accessToken) {
    throw new Error('GA4 connector requires propertyId and accessToken')
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
      dimensions: [{ name: 'date' }],
      limit: 100,
    }),
  })
  if (!res.ok) {
    throw new Error(`GA4 sync failed (${res.status})`)
  }
  const payload = (await res.json()) as { rows?: unknown[] }
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  return {
    rowsSynced: rows.length,
    metadata: { source: 'ga4', endpoint: 'runReport', syncedEntities: ['sessions'] },
  }
}

async function syncS3(config: Record<string, unknown>): Promise<ConnectorSyncResult> {
  const manifestUrl = asString(config.manifestUrl || config.indexUrl)
  if (!manifestUrl) {
    throw new Error('S3 connector requires manifestUrl')
  }
  const res = await fetch(manifestUrl)
  if (!res.ok) {
    throw new Error(`S3 sync failed (${res.status})`)
  }
  const payload = (await res.json()) as { objects?: unknown[] }
  const objects = Array.isArray(payload.objects) ? payload.objects : []
  return {
    rowsSynced: objects.length,
    metadata: { source: 's3', endpoint: 'manifest', syncedEntities: ['objects'] },
  }
}

export async function runConnectorSync(type: ConnectorType, config: Record<string, unknown>): Promise<ConnectorSyncResult> {
  if (type === 'SHOPIFY') {
    return syncShopify(config)
  }
  if (type === 'STRIPE') {
    return syncStripe(config)
  }
  if (type === 'GA4') {
    return syncGa4(config)
  }
  return syncS3(config)
}
