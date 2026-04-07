import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { normalizeColumnMapping } from '@/lib/column-mapper'
import type { ColumnMapping } from '@/lib/dataset-store'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type AnalyzeBody = {
  columns?: string[]
  sample?: Record<string, unknown>[]
  fileName?: string
  rowCount?: number
}

type AnalyzeResponse = {
  datasetType: string
  columnMapping: ColumnMapping
  insights: string[]
  suggestedKPIs: Array<{ label: string; value: string; delta: string; positive: boolean }>
  dateFormat: string | null
  currencySymbol: string
  missingColumns: string[]
  confidence: 'high' | 'medium' | 'low'
  analysisMode?: 'ai' | 'fallback'
}

const MAPPING_KEYS: (keyof ColumnMapping)[] = [
  'orderId',
  'date',
  'revenue',
  'category',
  'customerName',
  'customerSegment',
  'country',
  'quantity',
  'unitPrice',
  'paymentMethod',
  'paymentStatus',
  'isReturned',
  'returnReason',
  'rating',
  'discount',
  'productName',
]

const CANDIDATE_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  orderId: [/\border\s*id\b/i, /\bid\b/i, /transaction.*id/i, /invoice.*id/i],
  date: [/date/i, /order.*date/i, /transaction.*date/i, /created.*at/i, /timestamp/i],
  revenue: [/revenue/i, /sales?/i, /amount/i, /total/i, /gmv/i, /net.*sales/i],
  category: [/category/i, /product.*type/i, /department/i, /vertical/i],
  customerName: [/customer/i, /client/i, /buyer/i, /user/i, /account/i, /customer.*id/i, /client.*id/i],
  customerSegment: [/segment/i, /tier/i, /plan/i, /group/i, /cohort/i],
  country: [/country/i, /region/i, /location/i, /nation/i],
  quantity: [/quantity/i, /\bqty\b/i, /units?/i, /items?/i],
  unitPrice: [/unit.*price/i, /price/i, /rate/i, /unit.*cost/i],
  paymentMethod: [/payment.*method/i, /payment.*type/i, /method/i, /channel/i, /gateway/i],
  paymentStatus: [/payment.*status/i, /status/i, /order.*status/i],
  isReturned: [/return(ed)?/i, /is.*return/i, /refund(ed)?/i],
  returnReason: [/return.*reason/i, /refund.*reason/i, /reason/i],
  rating: [/rating/i, /review/i, /score/i, /stars?/i],
  discount: [/discount/i, /coupon/i, /promo/i, /markdown/i],
  productName: [/product/i, /item/i, /sku/i, /title/i, /name/i],
}

function pickColumn(columns: string[], patterns: RegExp[], used: Set<string>): string | null {
  for (const pattern of patterns) {
    const found = columns.find((c) => !used.has(c) && pattern.test(c))
    if (found) {
      used.add(found)
      return found
    }
  }
  return null
}

function detectDateFormat(sample: Record<string, unknown>[], dateColumn: string | null): string | null {
  if (!dateColumn) return null
  const val = sample.find((r) => r[dateColumn])?.[dateColumn]
  const str = typeof val === 'string' ? val.trim() : String(val ?? '')
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return 'YYYY-MM-DD'
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return 'MM/DD/YYYY'
  if (/^\d{2}-\d{2}-\d{4}/.test(str)) return 'DD-MM-YYYY'
  return null
}

function detectCurrencySymbol(sample: Record<string, unknown>[], revenueColumn: string | null): string {
  if (!revenueColumn) return '$'
  const val = sample.find((r) => r[revenueColumn])?.[revenueColumn]
  const str = typeof val === 'string' ? val : String(val ?? '')
  if (str.includes('€')) return '€'
  if (str.includes('£')) return '£'
  if (str.includes('₹')) return '₹'
  if (str.includes('¥')) return '¥'
  return '$'
}

function buildSuggestedKPIs(mapping: ColumnMapping): AnalyzeResponse['suggestedKPIs'] {
  const out: AnalyzeResponse['suggestedKPIs'] = []
  if (mapping.revenue) out.push({ label: 'Total Revenue', value: '—', delta: '+0.0%', positive: true })
  if (mapping.quantity) out.push({ label: 'Units Sold', value: '—', delta: '+0.0%', positive: true })
  if (mapping.customerName) out.push({ label: 'Active Customers', value: '—', delta: '+0.0%', positive: true })
  if (out.length === 0) out.push({ label: 'Total Rows', value: '—', delta: '+0.0%', positive: true })
  return out.slice(0, 4)
}

function buildFallbackAnalysis(columns: string[], sample: Record<string, unknown>[], rowCount: number): AnalyzeResponse {
  const used = new Set<string>()
  const rough: Partial<Record<keyof ColumnMapping, string | null>> = {}
  for (const key of MAPPING_KEYS) rough[key] = pickColumn(columns, CANDIDATE_PATTERNS[key], used)

  if (!rough.revenue && rough.quantity && rough.unitPrice) {
    // Keep revenue null to allow transformer quantity*unitPrice behavior.
    rough.revenue = null
  }

  const mapping = normalizeColumnMapping(rough, columns)
  const missingColumns = MAPPING_KEYS.filter((k) => !mapping[k])
  const dateFormat = detectDateFormat(sample, mapping.date)
  const currencySymbol = detectCurrencySymbol(sample, mapping.revenue)

  return {
    datasetType: 'Sales Dataset',
    columnMapping: mapping,
    insights: [
      `Detected ${columns.length} columns from ${rowCount.toLocaleString()} rows.`,
      mapping.date ? `Date column mapped to "${mapping.date}".` : 'No clear date column found; using inferred date defaults.',
      mapping.revenue ? `Revenue column mapped to "${mapping.revenue}".` : 'No direct revenue column mapped; quantity × unit price may be used.',
      'Fallback analyzer was used to auto-map likely columns.',
    ],
    suggestedKPIs: buildSuggestedKPIs(mapping),
    dateFormat,
    currencySymbol,
    missingColumns,
    confidence: missingColumns.length <= 4 ? 'medium' : 'low',
    analysisMode: 'fallback',
  }
}

export async function POST(req: NextRequest) {
  const csrfError = enforceCsrf(req)
  if (csrfError) return csrfError

  const auth = readAuthContext(req)
  if (!auth || !canAccess(auth.role, 'dataset:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as AnalyzeBody
  const { columns, sample, fileName = 'dataset', rowCount = 0 } = body

  if (!columns?.length || !sample?.length) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_key_here') {
    return NextResponse.json(buildFallbackAnalysis(columns, sample, rowCount))
  }

  try {
    const sampleStr = JSON.stringify(sample.slice(0, 20), null, 2)

    const prompt = `You are a data analyst. A user uploaded a file named "${fileName}" with ${rowCount} rows and these columns: ${columns.join(', ')}\n\nHere is a 20-row sample of the data:\n${sampleStr}\n\nReturn ONLY valid JSON with keys datasetType, columnMapping, insights, suggestedKPIs, dateFormat, currencySymbol, missingColumns, confidence. columnMapping should include keys orderId,date,revenue,category,customerName,customerSegment,country,quantity,unitPrice,paymentMethod,paymentStatus,isReturned,returnReason,rating,discount,productName. Use null where unknown.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed: {
      datasetType?: string
      columnMapping?: Record<string, string | null>
      insights?: string[]
      suggestedKPIs?: Array<{ label: string; aggregation?: string; column?: string; format?: string }>
      dateFormat?: string | null
      currencySymbol?: string
      missingColumns?: string[]
      confidence?: 'high' | 'medium' | 'low'
    }

    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON. Please try again.' }, { status: 500 })
    }

    const mapping = normalizeColumnMapping((parsed.columnMapping ?? {}) as Record<string, string | null>, columns)
    const suggested = (parsed.suggestedKPIs ?? []).slice(0, 4).map((k) => ({
      label: k.label,
      value: '—',
      delta: '+0.0%',
      positive: true,
    }))

    return NextResponse.json({
      datasetType: parsed.datasetType ?? 'Sales Dataset',
      columnMapping: mapping,
      insights: parsed.insights ?? [],
      suggestedKPIs: suggested,
      dateFormat: parsed.dateFormat ?? null,
      currencySymbol: parsed.currencySymbol ?? '$',
      missingColumns: parsed.missingColumns ?? [],
      confidence: parsed.confidence ?? 'medium',
      analysisMode: 'ai',
    })
  } catch (err) {
    console.error('analyze-dataset error:', err)
    return NextResponse.json(buildFallbackAnalysis(columns, sample, rowCount))
  }
}
