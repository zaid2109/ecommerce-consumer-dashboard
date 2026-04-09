import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/server/prisma'
import { normalizeColumnMapping } from '@/lib/column-mapper'
import type { ColumnMapping } from '@/lib/dataset-store'
import { transformDataset } from '@/lib/dataset-transformer'
import { readJsonArtifact, writeJsonArtifact } from '@/lib/server/artifact-store'

type CanonicalRowsResult = {
  rows: Record<string, unknown>[]
  sourceLabel: string
  sourceCursor?: string | null
}

function asString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function asNumber(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  const parsed = Number.parseFloat(String(input ?? ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(input: unknown): string {
  const raw = asString(input)
  const d = raw ? new Date(raw) : new Date()
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function dedupeByOrderId(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const key = asString(row.orderId ?? row.id)
    if (!key) continue
    map.set(key, row)
  }
  return Array.from(map.values())
}

function inferMapping(rows: Record<string, unknown>[]): ColumnMapping {
  const first = rows[0] ?? {}
  const available = Object.keys(first)
  return normalizeColumnMapping(
    {
      orderId: available.includes('orderId') ? 'orderId' : null,
      date: available.includes('date') ? 'date' : null,
      revenue: available.includes('revenue') ? 'revenue' : null,
      category: available.includes('category') ? 'category' : null,
      customerName: available.includes('customerName') ? 'customerName' : null,
      customerSegment: available.includes('customerSegment') ? 'customerSegment' : null,
      country: available.includes('country') ? 'country' : null,
      quantity: available.includes('quantity') ? 'quantity' : null,
      unitPrice: available.includes('unitPrice') ? 'unitPrice' : null,
      paymentMethod: available.includes('paymentMethod') ? 'paymentMethod' : null,
      paymentStatus: available.includes('paymentStatus') ? 'paymentStatus' : null,
      isReturned: available.includes('isReturned') ? 'isReturned' : null,
      returnReason: available.includes('returnReason') ? 'returnReason' : null,
      rating: available.includes('rating') ? 'rating' : null,
      discount: available.includes('discount') ? 'discount' : null,
      productName: available.includes('productName') ? 'productName' : null,
    },
    available
  )
}

function mapStripeChargeToRow(charge: Record<string, unknown>): Record<string, unknown> {
  return {
    orderId: asString(charge.id),
    date: toIsoDate(charge.created ? new Date(asNumber(charge.created) * 1000).toISOString() : new Date().toISOString()),
    revenue: asNumber(charge.amount) / 100,
    category: 'Payments',
    customerName: asString((charge.billing_details as { name?: unknown } | null)?.name) || 'Stripe Customer',
    customerSegment: 'Regular',
    country: asString((charge.billing_details as { address?: { country?: unknown } } | null)?.address?.country) || 'Unknown',
    quantity: 1,
    unitPrice: asNumber(charge.amount) / 100,
    paymentMethod: asString(charge.payment_method_details ? 'Credit Card' : 'Credit Card'),
    paymentStatus: asString(charge.status).toLowerCase() === 'succeeded' ? 'Completed' : 'Failed',
    isReturned: Boolean(charge.refunded),
    returnReason: Boolean(charge.refunded) ? 'Refunded' : '',
    rating: null,
    discount: 0,
    productName: asString((charge.description as string | null) ?? 'Stripe Charge'),
  }
}

function mapShopifyOrderToRow(order: Record<string, unknown>): Record<string, unknown> {
  const firstLineItem = ((order.line_items as unknown[])?.[0] ?? {}) as Record<string, unknown>
  const firstCustomer = (order.customer as Record<string, unknown> | null) ?? {}
  const customerName = `${asString(firstCustomer.first_name)} ${asString(firstCustomer.last_name)}`.trim() || 'Shopify Customer'
  return {
    orderId: asString(order.id),
    date: toIsoDate(order.created_at),
    revenue: asNumber(order.total_price),
    category: asString(firstLineItem.product_type) || 'E-commerce',
    customerName,
    customerSegment: 'Regular',
    country: asString((order.shipping_address as Record<string, unknown> | null)?.country) || 'Unknown',
    quantity: asNumber(firstLineItem.quantity) || 1,
    unitPrice: asNumber(firstLineItem.price),
    paymentMethod: 'Credit Card',
    paymentStatus: asString(order.financial_status).toLowerCase() === 'paid' ? 'Completed' : 'Pending',
    isReturned: false,
    returnReason: '',
    rating: null,
    discount: 0,
    productName: asString(firstLineItem.name) || 'Shopify Product',
  }
}

function mapGa4RowToOrder(row: Record<string, unknown>): Record<string, unknown> {
  const dims = ((row.dimensionValues as unknown[]) ?? []) as Array<{ value?: string }>
  const metrics = ((row.metricValues as unknown[]) ?? []) as Array<{ value?: string }>
  const dateRaw = dims[0]?.value ?? ''
  const sessions = asNumber(metrics[0]?.value ?? 0)
  const date = dateRaw.length === 8
    ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    : toIsoDate(dateRaw)

  return {
    orderId: `ga4-${date}`,
    date,
    revenue: sessions,
    category: 'Analytics',
    customerName: 'GA4 Aggregate',
    customerSegment: 'Regular',
    country: 'Unknown',
    quantity: sessions || 1,
    unitPrice: 1,
    paymentMethod: 'Credit Card',
    paymentStatus: 'Completed',
    isReturned: false,
    returnReason: '',
    rating: null,
    discount: 0,
    productName: 'GA4 Sessions',
  }
}

async function fetchCanonicalRows(type: 'SHOPIFY' | 'STRIPE' | 'GA4' | 'S3', config: Record<string, unknown>): Promise<CanonicalRowsResult> {
  if (type === 'SHOPIFY') {
    const shopDomain = asString(config.shopDomain || config.shop || config.store)
    const accessToken = asString(config.accessToken || config.token)
    const updatedAtMin = asString(config.updatedAtMin || config.cursor || '')
    const qs = new URLSearchParams({ limit: '250', status: 'any' })
    if (updatedAtMin) qs.set('updated_at_min', updatedAtMin)
    const res = await fetch(`https://${shopDomain}/admin/api/2024-01/orders.json?${qs.toString()}`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })
    if (!res.ok) throw new Error(`Shopify sync failed (${res.status})`)
    const payload = (await res.json()) as { orders?: Array<Record<string, unknown>> }
    const orders = Array.isArray(payload.orders) ? payload.orders : []
    const rows = orders.map(mapShopifyOrderToRow)
    const latestCursor = orders
      .map((o) => asString(o.updated_at))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
    return { rows, sourceLabel: 'shopify.orders', sourceCursor: latestCursor }
  }

  if (type === 'STRIPE') {
    const secretKey = asString(config.secretKey || config.apiKey || config.token)
    const createdGt = asNumber(config.createdGt || config.cursor || 0)
    const qs = new URLSearchParams({ limit: '100' })
    if (createdGt > 0) qs.set('created[gt]', String(Math.floor(createdGt)))
    const res = await fetch(`https://api.stripe.com/v1/charges?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) throw new Error(`Stripe sync failed (${res.status})`)
    const payload = (await res.json()) as { data?: Array<Record<string, unknown>> }
    const charges = Array.isArray(payload.data) ? payload.data : []
    const rows = charges.map(mapStripeChargeToRow)
    const latestCursor = charges
      .map((c) => asNumber(c.created))
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
      .at(-1)
    return { rows, sourceLabel: 'stripe.charges', sourceCursor: latestCursor ? String(latestCursor) : null }
  }

  if (type === 'GA4') {
    const propertyId = asString(config.propertyId)
    const accessToken = asString(config.accessToken || config.token)
    const startDate = asString(config.startDate || '30daysAgo')
    const endDate = asString(config.endDate || 'today')
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }],
        dimensions: [{ name: 'date' }],
        limit: 250000,
      }),
    })
    if (!res.ok) throw new Error(`GA4 sync failed (${res.status})`)
    const payload = (await res.json()) as { rows?: Array<Record<string, unknown>> }
    const sourceRows = Array.isArray(payload.rows) ? payload.rows : []
    const rows = sourceRows.map(mapGa4RowToOrder)
    const latestCursor = rows.map((r) => asString(r.date)).sort().at(-1) ?? null
    return { rows, sourceLabel: 'ga4.runReport', sourceCursor: latestCursor }
  }

  const manifestUrl = asString(config.manifestUrl || config.indexUrl)
  const res = await fetch(manifestUrl)
  if (!res.ok) throw new Error(`S3 sync failed (${res.status})`)
  const payload = (await res.json()) as { objects?: Array<Record<string, unknown>>; rows?: Array<Record<string, unknown>> }
  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.objects)
      ? payload.objects.map((obj, idx) => ({
          orderId: asString(obj.id || obj.key || `s3-${idx}`),
          date: toIsoDate(obj.date || obj.createdAt),
          revenue: asNumber(obj.revenue || obj.amount || 0),
          category: asString(obj.category || 'S3 Import'),
          customerName: asString(obj.customerName || 'S3 Customer'),
          customerSegment: asString(obj.customerSegment || 'Regular'),
          country: asString(obj.country || 'Unknown'),
          quantity: asNumber(obj.quantity || 1),
          unitPrice: asNumber(obj.unitPrice || obj.price || 0),
          paymentMethod: asString(obj.paymentMethod || 'Credit Card'),
          paymentStatus: asString(obj.paymentStatus || 'Completed'),
          isReturned: Boolean(obj.isReturned),
          returnReason: asString(obj.returnReason || ''),
          rating: asNumber(obj.rating || 0) || null,
          discount: asNumber(obj.discount || 0),
          productName: asString(obj.productName || obj.name || 'S3 Product'),
        }))
      : []
  return { rows, sourceLabel: 's3.manifest', sourceCursor: null }
}

export async function ingestConnectorToDataset(input: {
  connectorId: string
  workspaceId: string
  connectorType: 'SHOPIFY' | 'STRIPE' | 'GA4' | 'S3'
  config: Record<string, unknown>
  createdByUserId?: string | null
}): Promise<{
  datasetId: string
  rowsSynced: number
  cursor: string | null
  deduped: number
}> {
  const fetched = await fetchCanonicalRows(input.connectorType, input.config)
  const rows = dedupeByOrderId(fetched.rows)
  const mapping = inferMapping(rows)
  const transformed = transformDataset({ rows, mapping })

  const fingerprint = `${input.connectorType.toLowerCase()}-${Date.now()}`
  const rawKey = `workspace/${input.workspaceId}/raw/connector-${input.connectorId}-${fingerprint}.json`
  const processedKey = `workspace/${input.workspaceId}/processed/connector-${input.connectorId}-${fingerprint}.json`

  await writeJsonArtifact(rawKey, {
    rows,
    columns: Object.keys(rows[0] ?? {}),
    fileName: `${input.connectorType.toLowerCase()}-sync.json`,
    source: fetched.sourceLabel,
    cursor: fetched.sourceCursor ?? null,
  })
  await writeJsonArtifact(processedKey, {
    orders: transformed.orders,
    aggregated: transformed.aggregated,
    source: fetched.sourceLabel,
    cursor: fetched.sourceCursor ?? null,
  })

  const createdById =
    input.createdByUserId ??
    (
      await prisma.user.findFirst({
        where: { workspaceId: input.workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
        select: { id: true },
      })
    )?.id ??
    (await prisma.user.findFirst({ where: { workspaceId: input.workspaceId }, select: { id: true } }))?.id

  if (!createdById) {
    throw new Error('No workspace user found to attribute connector-ingested dataset')
  }

  const schemaPayload = {
    columns: Object.keys(rows[0] ?? {}),
    columnMapping: mapping as unknown as Record<string, string | null>,
    processedMetrics: {
      parser: 'connector',
      source: fetched.sourceLabel,
      watermark: fetched.sourceCursor ?? null,
      dedupedRows: rows.length,
      transformedRows: transformed.orders.length,
    },
  } as Prisma.InputJsonValue

  const dataset = await prisma.dataset.create({
    data: {
      workspaceId: input.workspaceId,
      name: `${input.connectorType} Sync ${new Date().toISOString().slice(0, 19)}`,
      sourceType: input.connectorType,
      status: 'READY',
      rowCount: transformed.orders.length,
      columnCount: Object.keys(rows[0] ?? {}).length,
      schema: schemaPayload,
      s3RawKey: rawKey,
      s3ProcessedKey: processedKey,
      createdById,
      version: 1,
    },
  })

  const previousMetadata = await readJsonArtifact<{ cursor?: string | null }>(
    `workspace/${input.workspaceId}/connectors/${input.connectorId}/state.json`
  )
  const nextCursor = fetched.sourceCursor ?? previousMetadata?.cursor ?? null
  await writeJsonArtifact(`workspace/${input.workspaceId}/connectors/${input.connectorId}/state.json`, {
    cursor: nextCursor,
    updatedAt: new Date().toISOString(),
  })

  return {
    datasetId: dataset.id,
    rowsSynced: transformed.orders.length,
    cursor: nextCursor,
    deduped: rows.length,
  }
}
