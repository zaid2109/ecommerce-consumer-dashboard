import { aggregated, orders } from './data-generator'
import type { Order } from './types'

export { aggregated, orders }
export const dataReady: Promise<{ orders: Order[]; aggregated: typeof aggregated }> = new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve({ orders, aggregated })
    return
  }

  const worker = new Worker('/workers/dataWorker.js')
  worker.addEventListener('message', (event: MessageEvent) => {
    const payload = event.data as { type: string; orders: Order[]; aggregated: typeof aggregated }
    if (payload?.type === 'done') {
      resolve({ orders: payload.orders, aggregated: payload.aggregated })
      worker.terminate()
    }
  })
  worker.postMessage({ type: 'start' })
})

export type FilterState = {
  dateRange: [Date, Date]
  categories: string[]
  segments: string[]
  countries: string[]
  paymentMethods: string[]
}

export function getFilteredOrders(filters: FilterState): Order[] {
  const [startDate, endDate] = filters.dateRange

  return orders.filter((order) => {
    const inDateRange = order.orderDate >= startDate && order.orderDate <= endDate
    const inCategory = filters.categories.length === 0 || filters.categories.includes(order.category)
    const inSegment = filters.segments.length === 0 || filters.segments.includes(order.customerSegment)
    const inCountry = filters.countries.length === 0 || filters.countries.includes(order.customerCountry)
    const inPaymentMethod = filters.paymentMethods.length === 0 || filters.paymentMethods.includes(order.paymentMethod)

    return inDateRange && inCategory && inSegment && inCountry && inPaymentMethod
  })
}
