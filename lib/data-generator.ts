import { faker } from '@faker-js/faker'
import type { Order, PreAggregated } from './types'

faker.seed(42)

const ORDER_COUNT = 100000
const CUSTOMER_POOL_SIZE = 10000

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

const PAYMENT_METHODS: Order['paymentMethod'][] = [
  'Credit Card',
  'Debit Card',
  'UPI',
  'Net Banking',
  'Wallet',
  'Buy Now Pay Later',
  'Cash on Delivery',
]

const PAYMENT_STATUSES: Order['paymentStatus'][] = ['Completed', 'Pending', 'Failed']

const RETURN_REASONS: NonNullable<Order['returnReason']>[] = [
  'Defective',
  'Wrong Item',
  'Changed Mind',
  'Size Issue',
  'Not as Described',
]

type CustomerStats = {
  orderCount: number
  totalSpend: number
  lastOrderDate: Date
}

type CategoryStats = {
  orders: number
  revenue: number
  returns: number
}

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const twoYearsAgoStart = new Date(todayStart)
twoYearsAgoStart.setDate(twoYearsAgoStart.getDate() - 729)

const dayKeys: string[] = []
const dailyRevenueMap = new Map<string, { gross: number; net: number }>()
for (let i = 0; i < 730; i += 1) {
  const day = new Date(twoYearsAgoStart)
  day.setDate(twoYearsAgoStart.getDate() + i)
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  dayKeys.push(key)
  dailyRevenueMap.set(key, { gross: 0, net: 0 })
}

const monthKeys: string[] = []
const monthIndexByKey = new Map<string, number>()
for (let i = 23; i >= 0; i -= 1) {
  const monthDate = new Date(todayStart.getFullYear(), todayStart.getMonth() - i, 1)
  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
  monthIndexByKey.set(monthKey, monthKeys.length)
  monthKeys.push(monthKey)
}

const monthlyByCategory: Record<string, number[]> = {}
for (const category of CATEGORIES) {
  monthlyByCategory[category] = new Array<number>(24).fill(0)
}

const paymentBreakdown: Record<Order['paymentMethod'], { count: number; revenue: number; failed: number }> = {
  'Credit Card': { count: 0, revenue: 0, failed: 0 },
  'Debit Card': { count: 0, revenue: 0, failed: 0 },
  UPI: { count: 0, revenue: 0, failed: 0 },
  'Net Banking': { count: 0, revenue: 0, failed: 0 },
  Wallet: { count: 0, revenue: 0, failed: 0 },
  'Buy Now Pay Later': { count: 0, revenue: 0, failed: 0 },
  'Cash on Delivery': { count: 0, revenue: 0, failed: 0 },
}

const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
const countryAggregate = new Map<string, { revenue: number; orders: number }>()
const categoryStats: Record<Order['category'], CategoryStats> = {
  Electronics: { orders: 0, revenue: 0, returns: 0 },
  Clothing: { orders: 0, revenue: 0, returns: 0 },
  'Home & Garden': { orders: 0, revenue: 0, returns: 0 },
  Sports: { orders: 0, revenue: 0, returns: 0 },
  Beauty: { orders: 0, revenue: 0, returns: 0 },
  Books: { orders: 0, revenue: 0, returns: 0 },
  Toys: { orders: 0, revenue: 0, returns: 0 },
  Automotive: { orders: 0, revenue: 0, returns: 0 },
  Food: { orders: 0, revenue: 0, returns: 0 },
  Jewelry: { orders: 0, revenue: 0, returns: 0 },
}

const customerIds = Array.from({ length: CUSTOMER_POOL_SIZE }, () => faker.string.uuid())
const customerInfoById = new Map<string, { name: string; email: string; city: string; country: string }>()
const customerStatsById = new Map<string, CustomerStats>()

export const orders: Order[] = new Array<Order>(ORDER_COUNT)

for (let i = 0; i < ORDER_COUNT; i += 1) {
  const customerId = customerIds[i % CUSTOMER_POOL_SIZE]

  let customerInfo = customerInfoById.get(customerId)
  if (!customerInfo) {
    customerInfo = {
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      city: faker.location.city(),
      country: faker.location.country(),
    }
    customerInfoById.set(customerId, customerInfo)
  }

  const orderDate = faker.date.between({ from: twoYearsAgoStart, to: now })
  const category = faker.helpers.arrayElement(CATEGORIES)
  const quantity = faker.number.int({ min: 1, max: 8 })
  const unitPrice = faker.number.float({ min: 9, max: 1500, fractionDigits: 2 })
  const revenue = quantity * unitPrice
  const paymentMethod = faker.helpers.arrayElement(PAYMENT_METHODS)
  const paymentStatus = faker.helpers.arrayElement(PAYMENT_STATUSES)
  const isReturned = faker.number.float({ min: 0, max: 1, fractionDigits: 6 }) < 0.12
  const hasRating = faker.number.float({ min: 0, max: 1, fractionDigits: 6 }) < 0.7
  const rating = hasRating ? faker.number.int({ min: 1, max: 5 }) : undefined
  const discountPercent = faker.number.float({ min: 0, max: 35, fractionDigits: 2 })
  const returnDate = isReturned ? faker.date.between({ from: orderDate, to: now }) : undefined
  const returnReason = isReturned ? faker.helpers.arrayElement(RETURN_REASONS) : undefined

  const order: Order = {
    id: faker.string.uuid(),
    customerId,
    customerName: customerInfo.name,
    customerEmail: customerInfo.email,
    customerSegment: 'New',
    customerCity: customerInfo.city,
    customerCountry: customerInfo.country,
    orderDate,
    category,
    productName: faker.commerce.productName(),
    quantity,
    unitPrice,
    revenue,
    paymentMethod,
    paymentStatus,
    isReturned,
    returnReason,
    returnDate,
    deliveryDays: faker.number.int({ min: 1, max: 14 }),
    rating,
    discountPercent,
  }

  orders[i] = order

  const dayKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`
  const dayRevenue = dailyRevenueMap.get(dayKey)
  if (dayRevenue) {
    dayRevenue.gross += revenue
    dayRevenue.net += revenue * (1 - discountPercent / 100)
  }

  const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
  const monthIndex = monthIndexByKey.get(monthKey)
  if (monthIndex !== undefined) {
    monthlyByCategory[category][monthIndex] += revenue
  }

  const paymentData = paymentBreakdown[paymentMethod]
  paymentData.count += 1
  paymentData.revenue += revenue
  if (paymentStatus === 'Failed') {
    paymentData.failed += 1
  }

  if (rating !== undefined) {
    ratingDistribution[String(rating)] += 1
  }

  const countryData = countryAggregate.get(customerInfo.country)
  if (countryData) {
    countryData.revenue += revenue
    countryData.orders += 1
  } else {
    countryAggregate.set(customerInfo.country, { revenue, orders: 1 })
  }

  const cat = categoryStats[category]
  cat.orders += 1
  cat.revenue += revenue
  if (isReturned) {
    cat.returns += 1
  }

  const customerStats = customerStatsById.get(customerId)
  if (customerStats) {
    customerStats.orderCount += 1
    customerStats.totalSpend += revenue
    if (orderDate > customerStats.lastOrderDate) {
      customerStats.lastOrderDate = orderDate
    }
  } else {
    customerStatsById.set(customerId, {
      orderCount: 1,
      totalSpend: revenue,
      lastOrderDate: orderDate,
    })
  }
}

const customerSegmentById = new Map<string, Order['customerSegment']>()
const segmentCounts: Record<Order['customerSegment'], number> = {
  VIP: 0,
  Regular: 0,
  New: 0,
  'At-Risk': 0,
  Churned: 0,
}

for (const [customerId, stats] of customerStatsById.entries()) {
  const daysSinceLastOrder = Math.floor((todayStart.getTime() - stats.lastOrderDate.getTime()) / 86400000)

  const recencyScore = daysSinceLastOrder < 30 ? 5 : daysSinceLastOrder < 60 ? 4 : daysSinceLastOrder < 90 ? 3 : daysSinceLastOrder < 180 ? 2 : 1
  const frequencyScore = stats.orderCount > 20 ? 5 : stats.orderCount > 10 ? 4 : stats.orderCount > 5 ? 3 : stats.orderCount > 2 ? 2 : 1
  const monetaryScore = stats.totalSpend > 10000 ? 5 : stats.totalSpend > 5000 ? 4 : stats.totalSpend > 1000 ? 3 : stats.totalSpend > 200 ? 2 : 1
  const combinedScore = recencyScore + frequencyScore + monetaryScore

  const segment: Order['customerSegment'] =
    combinedScore >= 12
      ? 'VIP'
      : combinedScore >= 8
        ? 'Regular'
        : combinedScore >= 5
          ? 'New'
          : combinedScore >= 3
            ? 'At-Risk'
            : 'Churned'

  customerSegmentById.set(customerId, segment)
  segmentCounts[segment] += 1
}

for (const order of orders) {
  order.customerSegment = customerSegmentById.get(order.customerId) ?? 'New'
}

const dailyRevenue = dayKeys.map((key) => {
  const values = dailyRevenueMap.get(key)
  return {
    date: key,
    gross: Number((values?.gross ?? 0).toFixed(2)),
    net: Number((values?.net ?? 0).toFixed(2)),
  }
})

const returnRateByCategory: Record<Order['category'], number> = {
  Electronics: 0,
  Clothing: 0,
  'Home & Garden': 0,
  Sports: 0,
  Beauty: 0,
  Books: 0,
  Toys: 0,
  Automotive: 0,
  Food: 0,
  Jewelry: 0,
}

for (const category of CATEGORIES) {
  const stats = categoryStats[category]
  returnRateByCategory[category] = stats.orders === 0 ? 0 : Number((stats.returns / stats.orders).toFixed(4))
}

const countryRevenue = Array.from(countryAggregate.entries())
  .map(([country, stats]) => ({
    country,
    revenue: Number(stats.revenue.toFixed(2)),
    orders: stats.orders,
  }))
  .sort((a, b) => b.revenue - a.revenue)

const topProducts = CATEGORIES.map((category) => {
  const stats = categoryStats[category]
  return {
    category,
    orders: stats.orders,
    revenue: Number(stats.revenue.toFixed(2)),
    returnRate: stats.orders === 0 ? 0 : Number((stats.returns / stats.orders).toFixed(4)),
  }
}).sort((a, b) => b.revenue - a.revenue)

export const aggregated: PreAggregated = {
  dailyRevenue,
  monthlyByCategory,
  segmentCounts,
  paymentBreakdown,
  returnRateByCategory,
  ratingDistribution,
  countryRevenue,
  topProducts,
}
