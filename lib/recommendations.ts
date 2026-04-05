import type { PreAggregated } from '@/lib/types'
import type { FilterState } from '@/lib/store'

export interface Action {
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
  icon: string
}

export function generateActions(aggregated: PreAggregated, _filters: FilterState): Action[] {
  const actions: Action[] = []

  const overallReturnRate =
    Object.values(aggregated.returnRateByCategory).reduce((s, v) => s + v, 0) /
    Math.max(Object.keys(aggregated.returnRateByCategory).length, 1)
  const topCountry = aggregated.countryRevenue[0]
  const totalCountryRevenue = aggregated.countryRevenue.reduce((s, c) => s + c.revenue, 0)
  const topCountryShare = topCountry ? topCountry.revenue / Math.max(totalCountryRevenue, 1) : 0
  const totalSegments = Object.values(aggregated.segmentCounts).reduce((s, v) => s + v, 0)
  const vipShare = aggregated.segmentCounts.VIP / Math.max(totalSegments, 1)
  const paymentAll = Object.values(aggregated.paymentBreakdown)
  const totalPaymentCount = paymentAll.reduce((s, p) => s + p.count, 0)
  const totalPaymentFailed = paymentAll.reduce((s, p) => s + p.failed, 0)
  const paymentFailureRate = totalPaymentFailed / Math.max(totalPaymentCount, 1)
  const repeatPurchaseRate = (aggregated.segmentCounts.Regular + aggregated.segmentCounts.VIP) / Math.max(totalSegments, 1)

  if (overallReturnRate > 0.12) {
    actions.push({
      title: 'Review return policy',
      description: 'Return rate exceeds threshold. Tighten policy and improve product quality checks.',
      priority: 'High',
      icon: 'RotateCcw',
    })
  }
  if (topCountryShare > 0.4) {
    actions.push({
      title: `Localize for ${topCountry.country}`,
      description: `Top country contributes ${(topCountryShare * 100).toFixed(1)}% of revenue. Localize checkout and offers.`,
      priority: 'Medium',
      icon: 'Globe',
    })
  }
  if (vipShare < 0.1) {
    actions.push({
      title: 'Strengthen loyalty program',
      description: `VIP share is only ${(vipShare * 100).toFixed(1)}%. Launch targeted upsell and rewards.`,
      priority: 'High',
      icon: 'Crown',
    })
  }
  if (paymentFailureRate > 0.05) {
    actions.push({
      title: 'Optimize payment flow',
      description: `Payment failures at ${(paymentFailureRate * 100).toFixed(1)}%. Improve retries and fallback methods.`,
      priority: 'High',
      icon: 'CreditCard',
    })
  }
  if (repeatPurchaseRate < 0.3) {
    actions.push({
      title: 'Boost repeat purchases',
      description: `Repeat purchase proxy is ${(repeatPurchaseRate * 100).toFixed(1)}%. Add retention lifecycle campaigns.`,
      priority: 'Medium',
      icon: 'Repeat',
    })
  }

  while (actions.length < 3) {
    actions.push({
      title: 'Monitor conversion funnel',
      description: 'Track monthly conversion and cart drop-offs to identify hidden friction.',
      priority: 'Low',
      icon: 'LineChart',
    })
  }

  return actions.slice(0, 3)
}
