import type { PreAggregated } from '@/lib/types'
import type { FilterState } from '@/lib/store'

export interface Insight {
  emoji: string
  text: string
  type: 'positive' | 'warning' | 'neutral'
}

function baseInsights(aggregated: PreAggregated): Insight[] {
  const totalRevenue = aggregated.topProducts.reduce((s, p) => s + p.revenue, 0)
  const top = aggregated.topProducts[0]
  const share = totalRevenue ? ((top?.revenue ?? 0) / totalRevenue) * 100 : 0

  const monthly = aggregated.monthlyByCategory[top?.category ?? ''] ?? []
  const curr = monthly[monthly.length - 1] ?? 0
  const prev = monthly[monthly.length - 2] ?? 0
  const mom = prev ? ((curr - prev) / prev) * 100 : 0

  const returnRates = Object.entries(aggregated.returnRateByCategory)
  const avgReturnRate =
    returnRates.reduce((s, [, v]) => s + v, 0) / Math.max(returnRates.length, 1)
  const [worstCategory, worstRate] =
    returnRates.sort((a, b) => b[1] - a[1])[0] ?? ['N/A', 0]

  const paymentRows = Object.entries(aggregated.paymentBreakdown).map(([name, value]) => ({
    name,
    growth: value.revenue / Math.max(value.count, 1),
  }))
  const fastestPayment = paymentRows.sort((a, b) => b.growth - a.growth)[0]

  const segEntries = Object.entries(aggregated.segmentCounts)
  const topSegment = segEntries.sort((a, b) => b[1] - a[1])[0]

  return [
    {
      emoji: '📈',
      text: `${top?.category ?? 'Top category'} leads revenue (${share.toFixed(1)}% share, ${mom.toFixed(
        1
      )}% MoM).`,
      type: mom >= 0 ? 'positive' : 'neutral',
    },
    {
      emoji: worstRate > avgReturnRate ? '⚠️' : '✅',
      text: `${worstCategory} return rate is ${(worstRate * 100).toFixed(1)}% vs ${(avgReturnRate * 100).toFixed(
        1
      )}% average.`,
      type: worstRate > avgReturnRate ? 'warning' : 'positive',
    },
    {
      emoji: '💳',
      text: `${fastestPayment?.name ?? 'Top method'} has the strongest payment productivity trend.`,
      type: 'neutral',
    },
    {
      emoji: '👥',
      text: `${topSegment?.[0] ?? 'Top segment'} is currently the largest customer segment.`,
      type: 'neutral',
    },
  ]
}

function pick(insights: Insight[]): Insight[] {
  return insights.filter(Boolean).slice(0, 2)
}

export function generateDashboardInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  const insights = pick(baseInsights(aggregated))
  return insights.length ? insights : [{ emoji: 'ℹ️', text: 'No significant trend detected.', type: 'neutral' }]
}

export function generateAnalyticsInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  const top = aggregated.topProducts[0]
  return pick([
    {
      emoji: '📊',
      text: `${top?.category ?? 'Top category'} has the highest order concentration in analytics view.`,
      type: 'neutral',
    },
    ...baseInsights(aggregated),
  ])
}

export function generateCustomerInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  const total = Object.values(aggregated.segmentCounts).reduce((s, v) => s + v, 0)
  const vip = aggregated.segmentCounts.VIP
  return pick([
    {
      emoji: vip / Math.max(total, 1) > 0.1 ? '💎' : '⚠️',
      text: `VIP customers represent ${((vip / Math.max(total, 1)) * 100).toFixed(1)}% of segment mix.`,
      type: vip / Math.max(total, 1) > 0.1 ? 'positive' : 'warning',
    },
    ...baseInsights(aggregated),
  ])
}

export function generateProductInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  return pick(baseInsights(aggregated))
}

export function generatePaymentInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  const entries = Object.entries(aggregated.paymentBreakdown)
  const top = entries.sort((a, b) => b[1].count - a[1].count)[0]
  const failRate = top ? (top[1].failed / Math.max(top[1].count, 1)) * 100 : 0
  return pick([
    {
      emoji: '💳',
      text: `${top?.[0] ?? 'Top method'} leads usage with ${failRate.toFixed(1)}% failure rate.`,
      type: failRate > 5 ? 'warning' : 'positive',
    },
    ...baseInsights(aggregated),
  ])
}

export function generateReturnInsights(
  aggregated: PreAggregated,
  _filters: FilterState
): Insight[] {
  const worst = Object.entries(aggregated.returnRateByCategory).sort((a, b) => b[1] - a[1])[0]
  return pick([
    {
      emoji: '↩️',
      text: `${worst?.[0] ?? 'N/A'} has the highest return pressure at ${((worst?.[1] ?? 0) * 100).toFixed(1)}%.`,
      type: (worst?.[1] ?? 0) > 0.12 ? 'warning' : 'neutral',
    },
    ...baseInsights(aggregated),
  ])
}
