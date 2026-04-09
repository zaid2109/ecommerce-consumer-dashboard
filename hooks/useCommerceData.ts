'use client'

import { useMemo } from 'react'
import { useFilteredOrders } from '@/hooks/useChartData'
import type { Order } from '@/lib/types'
import { KPI_FORMULAS } from '@/lib/kpi-formulas'

type CategoryAgg = {
  category: Order['category']
  orders: number
  grossRevenue: number
  returnsValue: number
  netRevenue: number
  returnRate: number
  avgRating: number
  avgPrice: number
  momGrowth: number
}

const CATEGORIES: Order['category'][] = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Beauty',
  'Books',
  'Toys',
  'Automotive',
  'Food',
  'Jewelry',
]

const SEGMENTS: Order['customerSegment'][] = ['VIP', 'Regular', 'New', 'At-Risk', 'Churned']
const METHODS: Order['paymentMethod'][] = [
  'Credit Card',
  'Debit Card',
  'UPI',
  'Net Banking',
  'Wallet',
  'Buy Now Pay Later',
  'Cash on Delivery',
]

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function recencyScore(days: number): number {
  if (days < 30) return 5
  if (days < 60) return 4
  if (days < 90) return 3
  if (days < 180) return 2
  return 1
}

function quartile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

export function useProductsData() {
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    const byCategory = new Map<Order['category'], { orders: number; gross: number; returns: number; prices: number[]; ratings: number[] }>()
    const monthly = new Map<string, Record<Order['category'], number>>()
    for (const category of CATEGORIES) byCategory.set(category, { orders: 0, gross: 0, returns: 0, prices: [], ratings: [] })

    for (const o of filteredOrders) {
      const row = byCategory.get(o.category)!
      row.orders += 1
      row.gross += o.revenue
      if (o.isReturned) row.returns += o.revenue
      row.prices.push(o.unitPrice)
      if (o.rating) row.ratings.push(o.rating)

      const mk = monthKey(o.orderDate)
      const m = monthly.get(mk) ?? Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Order['category'], number>
      m[o.category] += o.revenue
      monthly.set(mk, m)
    }

    const sortedMonths = Array.from(monthly.keys()).sort()
    const monthRows = sortedMonths.map((m) => ({ month: m, ...monthly.get(m)! }))

    const table: CategoryAgg[] = CATEGORIES.map((category) => {
      const row = byCategory.get(category)!
      const net = row.gross - row.returns
      const avgRating = row.ratings.length ? row.ratings.reduce((s, v) => s + v, 0) / row.ratings.length : 0
      const avgPrice = row.prices.length ? row.prices.reduce((s, v) => s + v, 0) / row.prices.length : 0
      const last2 = monthRows.slice(-2)
      const curr = last2[1]?.[category] ?? 0
      const prev = last2[0]?.[category] ?? 0
      const momGrowth = prev ? ((curr - prev) / prev) * 100 : 0
      return {
        category,
        orders: row.orders,
        grossRevenue: row.gross,
        returnsValue: row.returns,
        netRevenue: net,
        returnRate: KPI_FORMULAS.categoryReturnRateRatio(row.orders, row.returns),
        avgRating,
        avgPrice,
        momGrowth,
      }
    }).sort((a, b) => b.grossRevenue - a.grossRevenue)

    const totalOrders = filteredOrders.length || 1
    const uniqueSkuEstimate = Math.round(new Set(filteredOrders.map((o) => o.productName)).size * 1.15)
    const totalRevenue = filteredOrders.reduce((s, o) => s + o.revenue, 0)
    const avgOrderValue = KPI_FORMULAS.safeAverage(totalRevenue, totalOrders)

    const boxPlot = CATEGORIES.map((category) => {
      const prices = [...(byCategory.get(category)?.prices ?? [])].sort((a, b) => a - b)
      return {
        category,
        min: prices[0] ?? 0,
        q1: quartile(prices, 0.25),
        median: quartile(prices, 0.5),
        q3: quartile(prices, 0.75),
        max: prices[prices.length - 1] ?? 0,
      }
    })

    const insight = table[0]
    const actions = [
      `Optimize inventory depth for ${insight?.category ?? 'top category'} to protect growth.`,
      `Reduce return drivers in ${table.sort((a, b) => b.returnRate - a.returnRate)[0]?.category ?? 'high-return category'}.`,
      'Bundle low AOV categories to increase revenue per order.',
    ]

    return {
      kpi: {
        topCategory: insight?.category ?? 'N/A',
        totalSkus: uniqueSkuEstimate,
        avgOrderValue,
        revenuePerOrder: avgOrderValue,
      },
      categoryTable: table,
      treemapData: table.map((r) => ({ name: r.category, size: r.grossRevenue, returnRate: r.returnRate })),
      areaData: monthRows.slice(-24),
      radarData: table,
      boxPlotData: boxPlot,
      marginData: table,
      insight: `📈 ${insight?.category ?? 'Top category'} leads product revenue with ${((insight?.grossRevenue ?? 0) / Math.max(totalRevenue, 1) * 100).toFixed(1)}% share.`,
      actions,
    }
  }, [filteredOrders])
}

export function usePaymentsData() {
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    const byMethod = new Map<Order['paymentMethod'], { count: number; success: number; failedValue: number; amount: number }>()
    const segmentMethod: Record<Order['customerSegment'], Record<Order['paymentMethod'], number>> = Object.fromEntries(
      SEGMENTS.map((s) => [s, Object.fromEntries(METHODS.map((m) => [m, 0]))])
    ) as Record<Order['customerSegment'], Record<Order['paymentMethod'], number>>
    const monthly = new Map<string, Record<Order['paymentMethod'], number>>()

    for (const m of METHODS) byMethod.set(m, { count: 0, success: 0, failedValue: 0, amount: 0 })

    for (const o of filteredOrders) {
      const row = byMethod.get(o.paymentMethod)!
      row.count += 1
      row.amount += o.revenue
      if (o.paymentStatus === 'Completed') row.success += 1
      if (o.paymentStatus === 'Failed') row.failedValue += o.revenue
      segmentMethod[o.customerSegment][o.paymentMethod] += 1

      const mk = monthKey(o.orderDate)
      const mr = monthly.get(mk) ?? Object.fromEntries(METHODS.map((m) => [m, 0])) as Record<Order['paymentMethod'], number>
      mr[o.paymentMethod] += o.revenue
      monthly.set(mk, mr)
    }

    const methodRows = METHODS.map((method) => {
      const r = byMethod.get(method)!
      return {
        method,
        count: r.count,
        successRate: r.count ? (r.success / r.count) * 100 : 0,
        avgTransaction: r.count ? r.amount / r.count : 0,
        failedValue: r.failedValue,
        amount: r.amount,
      }
    })

    const totalCount = filteredOrders.length || 1
    const successRate = KPI_FORMULAS.returnRatePercent(
      totalCount,
      filteredOrders.filter((o) => o.paymentStatus === 'Completed').length
    )
    const avgTransactionValue = KPI_FORMULAS.safeAverage(
      filteredOrders.reduce((s, o) => s + o.revenue, 0),
      totalCount
    )
    const failedPayments = filteredOrders.filter((o) => o.paymentStatus === 'Failed').reduce((s, o) => s + o.revenue, 0)
    const topMethod = [...methodRows].sort((a, b) => b.count - a.count)[0]?.method ?? 'N/A'

    const monthRows = Array.from(monthly.keys()).sort().slice(-12).map((m) => ({ month: m, ...monthly.get(m)! }))
    const avgFail = methodRows.reduce((s, r) => s + (100 - r.successRate), 0) / Math.max(methodRows.length, 1)

    const segmentMethodMatrix = SEGMENTS.map((seg) => {
      const total = METHODS.reduce((s, m) => s + segmentMethod[seg][m], 0) || 1
      return {
        segment: seg,
        values: METHODS.map((m) => (segmentMethod[seg][m] / total) * 100),
      }
    })

    const tableRows = filteredOrders.map((o) => ({
      orderId: o.id,
      date: o.orderDate,
      method: o.paymentMethod,
      amount: o.revenue,
      status: o.paymentStatus,
      segment: o.customerSegment,
      category: o.category,
    }))

    return {
      kpi: { successRate, avgTransactionValue, failedPayments, topMethod },
      donutData: methodRows.map((r) => ({ name: r.method, value: r.count })),
      trendData: monthRows,
      failureData: methodRows.map((r) => ({ method: r.method, failureRate: 100 - r.successRate })).sort((a, b) => b.failureRate - a.failureRate),
      avgTxData: methodRows.map((r) => ({ method: r.method, value: r.avgTransaction })),
      segmentMethodHeatmap: { methods: METHODS, rows: segmentMethodMatrix },
      paymentTableRows: tableRows,
      avgFailureBenchmark: avgFail,
      insight: `📈 ${topMethod} is the leading method. Success rate is ${successRate.toFixed(1)}%, with ${failedPayments.toFixed(0)} lost revenue from failures.`,
      actions: ['Improve retries for failed transactions on top 2 failing methods.', 'Promote high-success payment options at checkout.', 'Add payment method nudges by customer segment.'],
    }
  }, [filteredOrders])
}

export function useReturnsData() {
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    const returned = filteredOrders.filter((o) => o.isReturned)
    const totalReturns = returned.length
    const refundValue = returned.reduce((s, o) => s + o.revenue, 0)
    const returnRate = KPI_FORMULAS.returnRatePercent(filteredOrders.length, totalReturns)
    const avgDaysToReturn =
      returned.length
        ? returned.reduce((s, o) => s + Math.max(0, Math.round(((o.returnDate?.getTime() ?? o.orderDate.getTime()) - o.orderDate.getTime()) / 86400000)), 0) / returned.length
        : 0

    const byCategory = new Map<Order['category'], { orders: number; returns: number; refunds: number }>()
    const byReason = new Map<string, number>()
    const bySegment = new Map<Order['customerSegment'], { returned: number; notReturned: number }>()
    const timeline = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, count: 0 }))
    const monthMap = new Map<string, { total: number; returns: number }>()
    const refundHeatmap = CATEGORIES.map((category) => ({ category, values: Array.from({ length: 24 }, () => 0) }))

    for (const c of CATEGORIES) byCategory.set(c, { orders: 0, returns: 0, refunds: 0 })
    for (const s of SEGMENTS) bySegment.set(s, { returned: 0, notReturned: 0 })

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 23, 1)

    for (const o of filteredOrders) {
      const cat = byCategory.get(o.category)!
      cat.orders += 1
      if (o.isReturned) {
        cat.returns += 1
        cat.refunds += o.revenue
      }

      const seg = bySegment.get(o.customerSegment)!
      if (o.isReturned) seg.returned += 1
      else seg.notReturned += 1

      const mk = monthKey(o.orderDate)
      const mm = monthMap.get(mk) ?? { total: 0, returns: 0 }
      mm.total += 1
      if (o.isReturned) mm.returns += 1
      monthMap.set(mk, mm)

      const midx = (o.orderDate.getFullYear() - start.getFullYear()) * 12 + (o.orderDate.getMonth() - start.getMonth())
      if (midx >= 0 && midx < 24) {
        const row = refundHeatmap.find((r) => r.category === o.category)!
        if (o.isReturned) row.values[midx] += 1
      }
    }

    for (const o of returned) {
      const reason = o.returnReason ?? 'Unknown'
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
      const days = Math.max(1, Math.min(30, Math.round(((o.returnDate?.getTime() ?? o.orderDate.getTime()) - o.orderDate.getTime()) / 86400000)))
      timeline[days - 1].count += 1
    }

    const monthlyRate = Array.from(monthMap.keys()).sort().slice(-24).map((m) => {
      const v = monthMap.get(m)!
      return { month: m, rate: v.total ? v.returns / v.total : 0 }
    })

    const categoryRateData = CATEGORIES.map((category) => {
      const c = byCategory.get(category)!
        return {
          category,
          rate: KPI_FORMULAS.returnRatePercent(c.orders, c.returns),
          refunds: c.refunds,
          orders: c.orders,
        }
    }).sort((a, b) => b.rate - a.rate)

    const returnBySegment = SEGMENTS.map((segment) => {
      const v = bySegment.get(segment)!
      return { segment, returned: v.returned, notReturned: v.notReturned }
    })

    const reasonDonut = Array.from(byReason.entries()).map(([name, value]) => ({ name, value }))
    const peak = [...timeline].sort((a, b) => b.count - a.count)[0]

    const tableRows = returned.map((o) => ({
      orderId: o.id,
      category: o.category,
      reason: o.returnReason ?? 'Unknown',
      daysToReturn: Math.max(1, Math.round(((o.returnDate?.getTime() ?? o.orderDate.getTime()) - o.orderDate.getTime()) / 86400000)),
      refundAmount: o.revenue,
      segment: o.customerSegment,
      resolution: o.paymentStatus === 'Completed' ? 'Refunded' : 'Pending',
    }))

    return {
      kpi: { totalReturns, refundValue, returnRate, avgDaysToReturn },
      categoryRateData,
      reasonDonut,
      returnTimeline: timeline,
      returnBySegment,
      returnRateOverTime: monthlyRate,
      refundHeatmap,
      returnsTableRows: tableRows,
      insight: `📈 Peak return day is Day ${peak?.day ?? 0}, with ${peak?.count ?? 0} returns. Focus post-delivery follow-up around this window.`,
      actions: [
        `Review return policy for ${categoryRateData[0]?.category ?? 'highest-return category'}.`,
        'Add proactive fit/quality guidance for high-return products.',
        'Shorten refund SLA for top-value returned segments.',
      ],
    }
  }, [filteredOrders])
}
