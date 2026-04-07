import { parse, isValid } from 'date-fns'
import type { Order, PreAggregated } from './types'
import type { ColumnMapping } from './dataset-store'

interface TransformOptions {
  rows: Record<string, unknown>[]
  mapping: ColumnMapping
  dateFormat?: string | null
  currencySymbol?: string
}

function parseDate(val: unknown, hintFormat?: string | null): Date | null {
  if (!val) return null
  if (val instanceof Date) return isValid(val) ? val : null

  const str = String(val).trim()
  const formats = [
    hintFormat,
    'yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'MM-dd-yyyy',
    'dd-MM-yyyy', 'yyyy/MM/dd', 'M/d/yyyy', 'd/M/yyyy',
    'MMM d, yyyy', 'MMMM d, yyyy', 'dd MMM yyyy',
    'yyyy-MM-dd HH:mm:ss', 'MM/dd/yyyy HH:mm:ss',
  ].filter(Boolean) as string[]

  for (const fmt of formats) {
    try {
      const d = parse(str, fmt, new Date())
      if (isValid(d) && d.getFullYear() > 1990 && d.getFullYear() < 2100) return d
    } catch {
      continue
    }
  }

  const native = new Date(str)
  return isValid(native) ? native : null
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/[$€£¥,\s]/g, '').trim()
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : n
}

function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val).toLowerCase().trim()
  return ['true', '1', 'yes', 'y', 'returned', 'return', 'refunded'].includes(s)
}

function normalizeStatus(val: unknown): 'Completed' | 'Pending' | 'Failed' {
  const s = String(val ?? '').toLowerCase().trim()
  if (['completed', 'complete', 'paid', 'success', 'successful', 'approved', 'done', 'delivered'].includes(s)) return 'Completed'
  if (['pending', 'processing', 'in progress', 'awaiting', 'on hold', 'draft'].includes(s)) return 'Pending'
  if (['failed', 'failure', 'cancelled', 'canceled', 'declined', 'rejected', 'error', 'refunded'].includes(s)) return 'Failed'
  return 'Completed'
}

function normalizeCategory(raw: unknown): Order['category'] {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value.includes('elect')) return 'Electronics'
  if (value.includes('cloth') || value.includes('apparel') || value.includes('fashion')) return 'Clothing'
  if (value.includes('home') || value.includes('garden') || value.includes('furniture')) return 'Home & Garden'
  if (value.includes('sport') || value.includes('fitness') || value.includes('outdoor')) return 'Sports'
  if (value.includes('beaut') || value.includes('cosmetic') || value.includes('skin')) return 'Beauty'
  if (value.includes('book') || value.includes('magazine')) return 'Books'
  if (value.includes('toy') || value.includes('game')) return 'Toys'
  if (value.includes('auto') || value.includes('car') || value.includes('vehicle')) return 'Automotive'
  if (value.includes('food') || value.includes('grocery') || value.includes('beverage')) return 'Food'
  if (value.includes('jewel') || value.includes('watch') || value.includes('accessor')) return 'Jewelry'
  return 'Electronics'
}

export function transformDataset({ rows, mapping, dateFormat }: TransformOptions): { aggregated: PreAggregated; orders: Order[] } {
  const now = new Date()
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(now.getFullYear() - 2)

  type NormRow = {
    id: string
    customerId: string
    date: Date
    revenue: number
    quantity: number
    unitPrice: number
    category: string
    productName: string
    customerName: string
    customerEmail: string
    customerCity: string
    customerSegment: string
    country: string
    paymentMethod: string
    paymentStatus: 'Completed' | 'Pending' | 'Failed'
    isReturned: boolean
    returnReason: string
    rating: number | null
    discount: number
    returnDate: Date | null
    deliveryDays: number
  }

  const normalized: NormRow[] = []

  for (const row of rows) {
    const g = (col: string | null) => (col ? row[col] : undefined)

    let date = parseDate(g(mapping.date), dateFormat)
    if (!date || !isValid(date)) {
      date = new Date(twoYearsAgo)
    }

    const quantity = Math.max(1, Math.round(toNumber(g(mapping.quantity)) || 1))
    const unitPrice = Math.max(0, toNumber(g(mapping.unitPrice)))
    let revenue = toNumber(g(mapping.revenue))
    if (revenue <= 0 && unitPrice > 0) {
      revenue = quantity * unitPrice
    }
    if (revenue <= 0) continue

    const category = normalizeCategory(g(mapping.category) ?? g(mapping.productName))
    const productName = String(g(mapping.productName) ?? category).trim() || category
    const customerName = String(g(mapping.customerName) ?? 'Unknown').trim() || 'Unknown'
    const customerEmail = `${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'customer'}@example.com`
    const customerCity = 'Unknown'
    const customerId = `upl-${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer'}`
    const mappedOrderId = String(g(mapping.orderId) ?? '').trim()

    const rawSeg = String(g(mapping.customerSegment) ?? '').trim()
    const segMap: Record<string, string> = {
      vip: 'VIP', premium: 'VIP', gold: 'VIP', platinum: 'VIP',
      regular: 'Regular', standard: 'Regular', silver: 'Regular',
      new: 'New', bronze: 'New', basic: 'New',
      'at-risk': 'At-Risk', atrisk: 'At-Risk', inactive: 'At-Risk',
      churned: 'Churned', lost: 'Churned',
    }
    const segment = segMap[rawSeg.toLowerCase()] ?? (rawSeg || 'Regular')

    const country = String(g(mapping.country) ?? 'Unknown').trim() || 'Unknown'
    const paymentMethod = String(g(mapping.paymentMethod) ?? 'Other').trim() || 'Other'
    const paymentStatus = normalizeStatus(g(mapping.paymentStatus))
    const isReturned = toBool(g(mapping.isReturned))
    const returnReason = String(g(mapping.returnReason) ?? '').trim()

    const rawRating = toNumber(g(mapping.rating))
    let rating: number | null = null
    if (rawRating > 0) {
      if (rawRating <= 5) rating = rawRating
      else if (rawRating <= 10) rating = Math.round(rawRating / 2)
      else if (rawRating <= 100) rating = Math.round((rawRating / 100) * 5)
    }

    let discount = toNumber(g(mapping.discount))
    if (discount > 1) discount = discount / 100
    if (discount < 0) discount = 0
    if (discount > 1) discount = 1

    const returnDate = isReturned ? new Date(date.getTime() + 7 * 86400000) : null
    const deliveryDays = 3

    normalized.push({
      id: mappedOrderId || crypto.randomUUID(),
      customerId,
      date,
      revenue,
      quantity,
      unitPrice: unitPrice > 0 ? unitPrice : revenue / quantity,
      category,
      productName,
      customerName,
      customerEmail,
      customerCity,
      customerSegment: segment,
      country,
      paymentMethod,
      paymentStatus,
      isReturned,
      returnReason,
      rating,
      discount,
      returnDate,
      deliveryDays,
    })
  }

  if (normalized.length === 0) {
    throw new Error('No valid rows found after transformation. Check your column mapping.')
  }

  const dayMap = new Map<string, { gross: number; net: number }>()
  const msPerDay = 86400000
  for (let i = 0; i < 730; i++) {
    const d = new Date(now.getTime() - (729 - i) * msPerDay)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { gross: 0, net: 0 })
  }

  for (const row of normalized) {
    const key = row.date.toISOString().slice(0, 10)
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!
      entry.gross += row.revenue
      if (!row.isReturned) entry.net += row.revenue
    }
  }

  const dailyRevenue = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    gross: Math.round(v.gross),
    net: Math.round(v.net),
  }))

  const catRevMap = new Map<string, number>()
  for (const row of normalized) {
    catRevMap.set(row.category, (catRevMap.get(row.category) ?? 0) + row.revenue)
  }

  const topCategories = Array.from(catRevMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat]) => cat)

  const monthlyByCategory: Record<string, number[]> = {}
  topCategories.forEach((cat) => {
    monthlyByCategory[cat] = new Array(24).fill(0)
  })

  for (const row of normalized) {
    if (!topCategories.includes(row.category)) continue
    const monthsAgo = Math.floor((now.getTime() - row.date.getTime()) / (30 * msPerDay))
    const idx = 23 - Math.min(monthsAgo, 23)
    if (idx >= 0 && idx < 24) monthlyByCategory[row.category][idx] += row.revenue
  }

  const segCounts: Record<string, number> = { VIP: 0, Regular: 0, New: 0, 'At-Risk': 0, Churned: 0 }
  const custSegMap = new Map<string, string>()
  for (const row of normalized) {
    custSegMap.set(row.customerName, row.customerSegment)
  }
  for (const seg of custSegMap.values()) {
    if (seg in segCounts) segCounts[seg] += 1
    else segCounts.Regular += 1
  }

  const paymentBreakdown: Record<string, { count: number; revenue: number; failed: number }> = {}
  for (const row of normalized) {
    if (!paymentBreakdown[row.paymentMethod]) {
      paymentBreakdown[row.paymentMethod] = { count: 0, revenue: 0, failed: 0 }
    }
    paymentBreakdown[row.paymentMethod].count += 1
    paymentBreakdown[row.paymentMethod].revenue += row.revenue
    if (row.paymentStatus === 'Failed') paymentBreakdown[row.paymentMethod].failed += 1
  }

  const catTotal: Record<string, number> = {}
  const catReturned: Record<string, number> = {}
  for (const row of normalized) {
    catTotal[row.category] = (catTotal[row.category] ?? 0) + 1
    if (row.isReturned) catReturned[row.category] = (catReturned[row.category] ?? 0) + 1
  }
  const returnRateByCategory: Record<string, number> = {}
  for (const cat of topCategories) {
    returnRateByCategory[cat] = catTotal[cat] > 0 ? (catReturned[cat] ?? 0) / catTotal[cat] : 0
  }

  const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const row of normalized) {
    if (row.rating !== null) {
      const key = String(Math.round(row.rating))
      if (key in ratingDistribution) ratingDistribution[key] += 1
    }
  }

  const countryMap = new Map<string, { revenue: number; orders: number }>()
  for (const row of normalized) {
    const entry = countryMap.get(row.country) ?? { revenue: 0, orders: 0 }
    entry.revenue += row.revenue
    entry.orders += 1
    countryMap.set(row.country, entry)
  }
  const countryRevenue = Array.from(countryMap.entries())
    .map(([country, v]) => ({ country, revenue: Math.round(v.revenue), orders: v.orders }))
    .sort((a, b) => b.revenue - a.revenue)

  const topProducts = topCategories.map((cat) => ({
    category: cat,
    orders: catTotal[cat] ?? 0,
    revenue: Math.round(catRevMap.get(cat) ?? 0),
    returnRate: returnRateByCategory[cat] ?? 0,
  }))

  const aggregated: PreAggregated = {
    dailyRevenue,
    monthlyByCategory,
    segmentCounts: segCounts as PreAggregated['segmentCounts'],
    paymentBreakdown: paymentBreakdown as PreAggregated['paymentBreakdown'],
    returnRateByCategory: returnRateByCategory as PreAggregated['returnRateByCategory'],
    ratingDistribution,
    countryRevenue,
    topProducts,
  }

  const allowedMethods: Order['paymentMethod'][] = [
    'Credit Card',
    'Debit Card',
    'UPI',
    'Net Banking',
    'Wallet',
    'Buy Now Pay Later',
    'Cash on Delivery',
  ]
  const allowedSegments: Order['customerSegment'][] = ['VIP', 'Regular', 'New', 'At-Risk', 'Churned']
  const allowedReasons: NonNullable<Order['returnReason']>[] = [
    'Defective',
    'Wrong Item',
    'Changed Mind',
    'Size Issue',
    'Not as Described',
  ]

  const asOrder = (row: NormRow, index: number): Order => ({
    id: row.id || `upl-order-${index + 1}`,
    customerId: row.customerId || `upl-customer-${index + 1}`,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerSegment: allowedSegments.includes(row.customerSegment as Order['customerSegment'])
      ? (row.customerSegment as Order['customerSegment'])
      : 'Regular',
    customerCity: row.customerCity,
    customerCountry: row.country,
    orderDate: row.date,
    category: normalizeCategory(row.category),
    productName: row.productName,
    quantity: Math.max(1, row.quantity),
    unitPrice: row.unitPrice > 0 ? row.unitPrice : row.revenue / Math.max(1, row.quantity),
    revenue: row.revenue,
    paymentMethod: allowedMethods.includes(row.paymentMethod as Order['paymentMethod'])
      ? (row.paymentMethod as Order['paymentMethod'])
      : 'Credit Card',
    paymentStatus: row.paymentStatus,
    isReturned: row.isReturned,
    returnReason: row.isReturned
      ? (allowedReasons.includes(row.returnReason as NonNullable<Order['returnReason']>)
          ? (row.returnReason as NonNullable<Order['returnReason']>)
          : 'Changed Mind')
      : undefined,
    returnDate: row.isReturned ? row.returnDate ?? new Date(row.date.getTime() + 7 * 86400000) : undefined,
    deliveryDays: row.deliveryDays,
    rating: row.rating !== null ? Math.max(1, Math.min(5, Math.round(row.rating))) : undefined,
    discountPercent: Math.round(row.discount * 100),
  })

  const orders = normalized.map(asOrder)
  return { aggregated, orders }
}
