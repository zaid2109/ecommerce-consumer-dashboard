'use client'

import { useMemo } from 'react'
import type { Order } from '@/lib/types'
import { useFilterStore } from '@/lib/store'
import { getColor } from '@/lib/utils'
import { useDataset } from './useDataset'
import { KPI_FORMULAS } from '@/lib/kpi-formulas'

type RevenuePoint = { date: string; gross: number; net: number }
type WeeklyPerformancePoint = { day: string; revenue: number; returns: number }

type KPIData = {
  totalRevenue: number
  totalOrders: number
  activeCustomers: number
  returnRate: number
  deltas: {
    revenue: number
    orders: number
    customers: number
    returnRate: number
  }
}

const ONE_DAY_MS = 86400000
const CATEGORY_LIST: Order['category'][] = [
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

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function safeDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

type FilterSlice = Pick<
  ReturnType<typeof useFilterStore.getState>,
  'dateRange' | 'categories' | 'segments' | 'countries' | 'paymentMethods'
>

function orderMatchesFilters(order: Order, filters: FilterSlice): boolean {
  const [start, end] = filters.dateRange
  if (order.orderDate < start || order.orderDate > end) return false
  if (filters.categories.length > 0 && !filters.categories.includes(order.category)) return false
  if (filters.segments.length > 0 && !filters.segments.includes(order.customerSegment)) return false
  if (filters.countries.length > 0 && !filters.countries.includes(order.customerCountry)) return false
  if (filters.paymentMethods.length > 0 && !filters.paymentMethods.includes(order.paymentMethod)) return false
  return true
}

function isOnlyDateFiltered(filters: FilterSlice): boolean {
  return (
    filters.categories.length === 0 &&
    filters.segments.length === 0 &&
    filters.countries.length === 0 &&
    filters.paymentMethods.length === 0
  )
}

function summarizeRange(rangeOrders: Order[]) {
  const customerSet = new Set<string>()
  let revenue = 0
  let returns = 0

  for (const order of rangeOrders) {
    revenue += order.revenue
    customerSet.add(order.customerId)
    if (order.isReturned) returns += 1
  }

  return {
    revenue,
    orders: rangeOrders.length,
    customers: customerSet.size,
    returnRate: rangeOrders.length === 0 ? 0 : (returns / rangeOrders.length) * 100,
  }
}

export function useKPIData(): KPIData {
  const { aggregated, orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => {
    const currentOrders = orders.filter((order) => orderMatchesFilters(order, filterState))
    const current = summarizeRange(currentOrders)

    const [start, end] = filterState.dateRange
    const rangeMs = end.getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - rangeMs - ONE_DAY_MS)
    const prevEnd = new Date(start.getTime() - ONE_DAY_MS)

    const previousOrders = orders.filter((order) => {
      if (order.orderDate < prevStart || order.orderDate > prevEnd) return false
      if (filterState.categories.length > 0 && !filterState.categories.includes(order.category)) return false
      if (filterState.segments.length > 0 && !filterState.segments.includes(order.customerSegment)) return false
      if (filterState.countries.length > 0 && !filterState.countries.includes(order.customerCountry)) return false
      if (filterState.paymentMethods.length > 0 && !filterState.paymentMethods.includes(order.paymentMethod)) return false
      return true
    })

    const previous = summarizeRange(previousOrders)

    return {
      totalRevenue: current.revenue,
      totalOrders: current.orders,
      activeCustomers: current.customers,
      returnRate: current.returnRate,
      deltas: {
        revenue: safeDelta(current.revenue, previous.revenue),
        orders: safeDelta(current.orders, previous.orders),
        customers: safeDelta(current.customers, previous.customers),
        returnRate: safeDelta(current.returnRate, previous.returnRate),
      },
    }
  }, [filterState, aggregated, orders])
}

export function useFilteredOrders(): Order[] {
  const { orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => orders.filter((order) => orderMatchesFilters(order, filterState)), [filterState, orders])
}

export function useDailyRevenue(granularity: 'daily' | 'weekly' | 'monthly'): RevenuePoint[] {
  const { aggregated, orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => {
    const [startDate, endDate] = filterState.dateRange
    const startKey = formatDay(toStartOfDay(startDate))
    const endKey = formatDay(toStartOfDay(endDate))
    const canUsePreAggregated = isOnlyDateFiltered(filterState)

    let baseDaily: RevenuePoint[]

    if (canUsePreAggregated) {
      baseDaily = aggregated.dailyRevenue.filter((item) => item.date >= startKey && item.date <= endKey)
    } else {
      const map = new Map<string, RevenuePoint>()
      for (const order of orders) {
        if (!orderMatchesFilters(order, filterState)) continue
        const key = formatDay(toStartOfDay(order.orderDate))
        const row = map.get(key) ?? { date: key, gross: 0, net: 0 }
        row.gross += order.revenue
        row.net += order.revenue * (1 - order.discountPercent / 100)
        map.set(key, row)
      }
      baseDaily = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
    }

    if (granularity === 'daily') return baseDaily

    const bucketMap = new Map<string, RevenuePoint>()
    for (const row of baseDaily) {
      const date = new Date(`${row.date}T00:00:00`)
      const key =
        granularity === 'weekly'
          ? formatDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()))
          : formatMonth(date)

      const bucket = bucketMap.get(key) ?? { date: key, gross: 0, net: 0 }
      bucket.gross += row.gross
      bucket.net += row.net
      bucketMap.set(key, bucket)
    }

    return Array.from(bucketMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filterState, granularity, aggregated, orders])
}

export function useCategoryData() {
  const { aggregated, orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => {
    const categoryTotals = new Map<Order['category'], { orders: number; returns: number; revenue: number }>()
    for (const category of CATEGORY_LIST) {
      categoryTotals.set(category, { orders: 0, returns: 0, revenue: 0 })
    }

    for (const order of orders) {
      if (!orderMatchesFilters(order, filterState)) continue
      const totals = categoryTotals.get(order.category)
      if (!totals) continue
      totals.orders += 1
      if (order.isReturned) totals.returns += 1
      totals.revenue += order.revenue
    }

    return CATEGORY_LIST
      .map((category, index) => {
        const totals = categoryTotals.get(category)!
        const trend = aggregated.monthlyByCategory[category]?.slice(-12) ?? []
        return {
          rank: 0,
          category,
          orders: totals.orders,
          revenue: totals.revenue,
          returnRate: KPI_FORMULAS.returnRatePercent(totals.orders, totals.returns),
          trend,
          color: getColor(index),
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, 10)
  }, [filterState, aggregated, orders])
}

export function useSegmentData() {
  const { orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => {
    const counts: Record<Order['customerSegment'], number> = {
      VIP: 0,
      Regular: 0,
      New: 0,
      'At-Risk': 0,
      Churned: 0,
    }

    for (const order of orders) {
      if (!orderMatchesFilters(order, filterState)) continue
      counts[order.customerSegment] += 1
    }

    return Object.entries(counts).map(([name, value], index) => ({ name, value, color: getColor(index) }))
  }, [filterState, orders])
}

export function useActivityEvents() {
  const { orders } = useDataset()
  const filterState = useFilterStore((state) => ({
    dateRange: state.dateRange,
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }))

  return useMemo(() => {
    return orders
      .filter((order) => orderMatchesFilters(order, filterState))
      .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        type: order.isReturned ? ('return' as const) : order.customerSegment === 'VIP' ? ('vip' as const) : ('order' as const),
        text: order.isReturned
          ? `${order.customerName} returned ${order.productName}`
          : order.customerSegment === 'VIP'
            ? `VIP ${order.customerName} placed a ${order.category} order`
            : `${order.customerName} placed an order for ${order.productName}`,
        time: order.orderDate,
      }))
  }, [filterState, orders])
}

export function useWeeklyPerformanceData(): WeeklyPerformancePoint[] {
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const rows = dayNames.map((day) => ({ day, revenue: 0, returns: 0 }))

    for (const order of filteredOrders) {
      const dayIndex = order.orderDate.getDay()
      rows[dayIndex].revenue += order.revenue
      if (order.isReturned) rows[dayIndex].returns += order.revenue
    }

    return rows
  }, [filteredOrders])
}

export function useCountryRevenueData() {
  const { aggregated, orders } = useDataset()
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    if (filteredOrders.length === orders.length) {
      return aggregated.countryRevenue
    }

    const map = new Map<string, { country: string; orders: number; revenue: number }>()
    for (const order of filteredOrders) {
      const row = map.get(order.customerCountry) ?? { country: order.customerCountry, orders: 0, revenue: 0 }
      row.orders += 1
      row.revenue += order.revenue
      map.set(order.customerCountry, row)
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders, aggregated, orders])
}

export function useRatingDistributionData() {
  const { aggregated, orders } = useDataset()
  const filteredOrders = useFilteredOrders()

  return useMemo(() => {
    if (filteredOrders.length === orders.length) {
      const counts = aggregated.ratingDistribution
      const sum = Object.entries(counts).reduce((acc, [k, v]) => acc + Number(k) * v, 0)
      const ratedCount = Object.values(counts).reduce((acc, v) => acc + v, 0)
      return { counts, average: ratedCount === 0 ? 0 : sum / ratedCount }
    }

    const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    let sum = 0
    let ratedCount = 0

    for (const order of filteredOrders) {
      if (!order.rating) continue
      const key = String(order.rating) as keyof typeof counts
      counts[key] += 1
      sum += order.rating
      ratedCount += 1
    }

    return { counts, average: ratedCount === 0 ? 0 : sum / ratedCount }
  }, [filteredOrders, aggregated, orders])
}

const useChartData = {
  useKPIData,
  useFilteredOrders,
  useDailyRevenue,
  useCategoryData,
  useSegmentData,
  useActivityEvents,
  useWeeklyPerformanceData,
  useCountryRevenueData,
  useRatingDistributionData,
}

export default useChartData

