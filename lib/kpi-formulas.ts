import type { Order } from '@/lib/types'

export const KPI_FORMULAS = {
  returnRatePercent(totalOrders: number, returnedOrders: number): number {
    if (totalOrders <= 0) return 0
    return (returnedOrders / totalOrders) * 100
  },
  categoryReturnRateRatio(totalOrders: number, returnedOrders: number): number {
    if (totalOrders <= 0) return 0
    return returnedOrders / totalOrders
  },
  safeAverage(total: number, count: number): number {
    if (count <= 0) return 0
    return total / count
  },
  deterministicScatterSample<T extends { customerId: string }>(rows: T[], max = 2000): T[] {
    return rows
      .slice()
      .sort((a, b) => a.customerId.localeCompare(b.customerId))
      .slice(0, max)
  },
  categoryTotals(orders: Order[]): Map<Order['category'], { orders: number; returns: number; revenue: number }> {
    const map = new Map<Order['category'], { orders: number; returns: number; revenue: number }>()
    for (const order of orders) {
      const row = map.get(order.category) ?? { orders: 0, returns: 0, revenue: 0 }
      row.orders += 1
      if (order.isReturned) row.returns += 1
      row.revenue += order.revenue
      map.set(order.category, row)
    }
    return map
  },
}
