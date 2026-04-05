'use client'

import { useMemo } from 'react'
import type { Order } from '@/lib/types'
import { useFilterStore } from '@/lib/store'
import { useDataset } from './useDataset'

type CustomerRow = {
  customerId: string
  name: string
  email: string
  segment: Order['customerSegment']
  totalOrders: number
  totalSpent: number
  firstOrder: Date
  lastOrder: Date
  daysSinceLast: number
  country: string
  rfmScore: number
  recencyScore: number
}

const DAY_MS = 86400000

function scoreRecency(days: number): number {
  if (days < 30) return 5
  if (days < 60) return 4
  if (days < 90) return 3
  if (days < 180) return 2
  return 1
}

function scoreFrequency(count: number): number {
  if (count > 20) return 5
  if (count > 10) return 4
  if (count > 5) return 3
  if (count > 2) return 2
  return 1
}

function scoreMonetary(spend: number): number {
  if (spend > 10000) return 5
  if (spend > 5000) return 4
  if (spend > 1000) return 3
  if (spend > 200) return 2
  return 1
}

function match(order: Order, filters: ReturnType<typeof useFilterStore.getState>): boolean {
  const [start, end] = filters.dateRange
  if (order.orderDate < start || order.orderDate > end) return false
  if (filters.categories.length && !filters.categories.includes(order.category)) return false
  if (filters.segments.length && !filters.segments.includes(order.customerSegment)) return false
  if (filters.countries.length && !filters.countries.includes(order.customerCountry)) return false
  if (filters.paymentMethods.length && !filters.paymentMethods.includes(order.paymentMethod)) return false
  return true
}

export function useCustomerAggregates() {
  const { orders } = useDataset()
  const filters = useFilterStore()

  return useMemo(() => {
    const byCustomer = new Map<string, CustomerRow>()
    const filteredOrders: Order[] = []
    const now = Date.now()

    for (const order of orders) {
      if (!match(order, filters)) continue
      filteredOrders.push(order)
      const row = byCustomer.get(order.customerId)
      if (!row) {
        byCustomer.set(order.customerId, {
          customerId: order.customerId,
          name: order.customerName,
          email: order.customerEmail,
          segment: order.customerSegment,
          totalOrders: 1,
          totalSpent: order.revenue,
          firstOrder: order.orderDate,
          lastOrder: order.orderDate,
          daysSinceLast: Math.floor((now - order.orderDate.getTime()) / DAY_MS),
          country: order.customerCountry,
          rfmScore: 0,
          recencyScore: 0,
        })
      } else {
        row.totalOrders += 1
        row.totalSpent += order.revenue
        if (order.orderDate < row.firstOrder) row.firstOrder = order.orderDate
        if (order.orderDate > row.lastOrder) row.lastOrder = order.orderDate
        row.daysSinceLast = Math.floor((now - row.lastOrder.getTime()) / DAY_MS)
      }
    }

    const customers = Array.from(byCustomer.values()).map((row) => {
      const recency = scoreRecency(row.daysSinceLast)
      const score = recency + scoreFrequency(row.totalOrders) + scoreMonetary(row.totalSpent)
      return { ...row, recencyScore: recency, rfmScore: score }
    })

    return { customers, filteredOrders }
  }, [filters, orders])
}

export function useAnalyticsPageData() {
  const { customers, filteredOrders } = useCustomerAggregates()

  return useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalCustomers = customers.length || 1
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0)
    const repeatCustomers = customers.filter((c) => c.totalOrders > 1).length

    const avgOrdersPerCustomer = totalOrders / totalCustomers
    const repeatPurchaseRate = (repeatCustomers / totalCustomers) * 100
    const estimatedLTV = totalRevenue / totalCustomers

    let intervalsSum = 0
    let intervalsCount = 0
    const byCustomerDates = new Map<string, Date[]>()
    for (const order of filteredOrders) {
      const arr = byCustomerDates.get(order.customerId) ?? []
      arr.push(order.orderDate)
      byCustomerDates.set(order.customerId, arr)
    }
    for (const dates of byCustomerDates.values()) {
      dates.sort((a, b) => a.getTime() - b.getTime())
      for (let i = 1; i < dates.length; i += 1) {
        intervalsSum += (dates[i].getTime() - dates[i - 1].getTime()) / DAY_MS
        intervalsCount += 1
      }
    }
    const avgDaysBetween = intervalsCount ? intervalsSum / intervalsCount : 0

    const buckets = [
      { bucket: '1 order', count: 0 },
      { bucket: '2', count: 0 },
      { bucket: '3', count: 0 },
      { bucket: '4', count: 0 },
      { bucket: '5', count: 0 },
      { bucket: '6-10', count: 0 },
      { bucket: '10+', count: 0 },
    ]
    for (const c of customers) {
      if (c.totalOrders === 1) buckets[0].count += 1
      else if (c.totalOrders === 2) buckets[1].count += 1
      else if (c.totalOrders === 3) buckets[2].count += 1
      else if (c.totalOrders === 4) buckets[3].count += 1
      else if (c.totalOrders === 5) buckets[4].count += 1
      else if (c.totalOrders <= 10) buckets[5].count += 1
      else buckets[6].count += 1
    }

    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayCounts = dayOrder.map((day) => ({ day, orders: 0 }))
    const timeHeatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
    for (const order of filteredOrders) {
      const jsDay = order.orderDate.getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      const hr = order.orderDate.getHours()
      dayCounts[idx].orders += 1
      timeHeatmap[idx][hr] += 1
    }

    const dailyMap = new Map<string, number>()
    for (const order of filteredOrders) {
      const d = new Date(order.orderDate.getFullYear(), order.orderDate.getMonth(), order.orderDate.getDate())
      const key = d.toISOString().slice(0, 10)
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + order.revenue)
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, raw]) => ({ date, raw }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const movingAverage = daily.map((p, i, arr) => {
      const w7 = arr.slice(Math.max(0, i - 6), i + 1)
      const w30 = arr.slice(Math.max(0, i - 29), i + 1)
      const ma7 = w7.reduce((s, x) => s + x.raw, 0) / w7.length
      const ma30 = w30.reduce((s, x) => s + x.raw, 0) / w30.length
      return { date: p.date, raw: p.raw, ma7, ma30 }
    })

    const cohorts = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => 0))
    const cohortMembers = Array.from({ length: 12 }, () => 0)
    const now = new Date()
    const month0 = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const byCustomerMonths = new Map<string, number[]>()
    for (const o of filteredOrders) {
      const idx =
        (o.orderDate.getFullYear() - month0.getFullYear()) * 12 + (o.orderDate.getMonth() - month0.getMonth())
      if (idx < 0 || idx > 11) continue
      const arr = byCustomerMonths.get(o.customerId) ?? []
      arr.push(idx)
      byCustomerMonths.set(o.customerId, arr)
    }
    for (const months of byCustomerMonths.values()) {
      const uniq = Array.from(new Set(months)).sort((a, b) => a - b)
      if (!uniq.length) continue
      const cohort = uniq[0]
      cohortMembers[cohort] += 1
      for (const m of uniq) {
        const offset = m - cohort
        if (offset >= 0 && offset < 12) cohorts[cohort][offset] += 1
      }
    }
    for (let r = 0; r < 12; r += 1) {
      for (let c = 0; c < 12; c += 1) {
        cohorts[r][c] = cohortMembers[r] ? Math.round((cohorts[r][c] / cohortMembers[r]) * 100) : 0
      }
    }

    return {
      kpi: { avgOrdersPerCustomer, repeatPurchaseRate, avgDaysBetween, estimatedLTV },
      frequencyData: buckets,
      cohortData: cohorts,
      dayOfWeekData: dayCounts,
      timeOfDayData: timeHeatmap,
      movingAverageData: movingAverage,
      tableRows: customers,
      insight: `📈 Repeat purchase rate is ${repeatPurchaseRate.toFixed(1)}% with avg ${avgOrdersPerCustomer.toFixed(
        2
      )} orders/customer. Biggest lift opportunity is customers still at 1 order.`,
    }
  }, [customers, filteredOrders])
}

export function useCustomersPageData() {
  const { customers, filteredOrders } = useCustomerAggregates()

  return useMemo(() => {
    const segmentCounts = { VIP: 0, Regular: 0, New: 0, 'At-Risk': 0, Churned: 0 } as Record<
      Order['customerSegment'],
      number
    >
    for (const c of customers) segmentCounts[c.segment] += 1

    const avgCLV = customers.length ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length : 0
    const segmentColor: Record<Order['customerSegment'], string> = {
      VIP: '#6366f1',
      Regular: '#8b5cf6',
      New: '#06b6d4',
      'At-Risk': '#f59e0b',
      Churned: '#ef4444',
    }
    const donutData = (Object.keys(segmentCounts) as Order['customerSegment'][]).map((seg) => ({
      name: seg,
      value: segmentCounts[seg],
      color: segmentColor[seg],
    }))

    const sampleScatter = customers
      .filter(() => Math.random() < 0.02)
      .slice(0, 2000)
      .map((c) => ({
        name: c.name,
        segment: c.segment,
        frequency: c.totalOrders,
        monetary: c.totalSpent,
        recency: c.recencyScore,
      }))

    const monthBars = Array.from({ length: 12 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      return { month: d.toLocaleString('en-US', { month: 'short' }), VIP: 0, Regular: 0, New: 0, 'At-Risk': 0 }
    })
    const start = new Date()
    start.setMonth(start.getMonth() - 11)
    start.setDate(1)
    for (const o of filteredOrders) {
      const idx = (o.orderDate.getFullYear() - start.getFullYear()) * 12 + (o.orderDate.getMonth() - start.getMonth())
      if (idx < 0 || idx > 11) continue
      if (o.customerSegment === 'Churned') continue
      monthBars[idx][o.customerSegment] += o.revenue
    }

    const clvBins = [
      { bin: '0-100', count: 0 },
      { bin: '100-500', count: 0 },
      { bin: '500-1k', count: 0 },
      { bin: '1k-5k', count: 0 },
      { bin: '5k-10k', count: 0 },
      { bin: '10k+', count: 0 },
    ]
    for (const c of customers) {
      if (c.totalSpent < 100) clvBins[0].count += 1
      else if (c.totalSpent < 500) clvBins[1].count += 1
      else if (c.totalSpent < 1000) clvBins[2].count += 1
      else if (c.totalSpent < 5000) clvBins[3].count += 1
      else if (c.totalSpent < 10000) clvBins[4].count += 1
      else clvBins[5].count += 1
    }

    const countryMap = new Map<string, number>()
    for (const o of filteredOrders) countryMap.set(o.customerCountry, (countryMap.get(o.customerCountry) ?? 0) + o.revenue)
    const treemapData = Array.from(countryMap.entries())
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 20)

    return {
      kpi: { vip: segmentCounts.VIP, regular: segmentCounts.Regular, atRisk: segmentCounts['At-Risk'], avgCLV },
      donutData,
      scatterData: sampleScatter,
      segmentRevenueData: monthBars,
      clvHistogramData: clvBins,
      treemapData,
      tableRows: customers,
      insight: `📈 VIP + Regular customers contribute ${(
        ((segmentCounts.VIP + segmentCounts.Regular) / Math.max(customers.length, 1)) *
        100
      ).toFixed(1)}% of active customers. Boosting At-Risk recovery can raise CLV quickly.`,
    }
  }, [customers, filteredOrders])
}
