/* eslint-disable no-restricted-globals */
const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Beauty', 'Books', 'Toys', 'Automotive', 'Food', 'Jewelry']
const methods = ['Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet', 'Buy Now Pay Later', 'Cash on Delivery']
const segments = ['VIP', 'Regular', 'New', 'At-Risk', 'Churned']
const statuses = ['Completed', 'Pending', 'Failed']
const reasons = ['Defective', 'Wrong Item', 'Changed Mind', 'Size Issue', 'Not as Described']

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 4294967296
  }
}

self.onmessage = (event) => {
  if (event.data?.type !== 'start') return
  const random = rng(42)
  const total = 100000
  const now = Date.now()
  const twoYearsMs = 730 * 86400000
  const orders = new Array(total)

  const dailyMap = new Map()
  for (let i = 0; i < 730; i += 1) {
    const d = new Date(now - (729 - i) * 86400000)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { gross: 0, net: 0 })
  }

  for (let i = 0; i < total; i += 1) {
    const orderDate = new Date(now - Math.floor(random() * twoYearsMs))
    const quantity = 1 + Math.floor(random() * 8)
    const unitPrice = Math.round((9 + random() * 1491) * 100) / 100
    const revenue = quantity * unitPrice
    const discountPercent = Math.round(random() * 35 * 100) / 100
    const isReturned = random() < 0.12
    const hasRating = random() < 0.7
    const dayKey = orderDate.toISOString().slice(0, 10)
    const day = dailyMap.get(dayKey)
    if (day) {
      day.gross += revenue
      day.net += revenue * (1 - discountPercent / 100)
    }

    orders[i] = {
      id: `ord-${i}`,
      customerId: `cust-${i % 10000}`,
      customerName: `Customer ${i % 10000}`,
      customerEmail: `customer${i % 10000}@example.com`,
      customerSegment: segments[Math.floor(random() * segments.length)],
      customerCity: 'City',
      customerCountry: 'United States',
      orderDate,
      category: categories[Math.floor(random() * categories.length)],
      productName: `Product ${i % 500}`,
      quantity,
      unitPrice,
      revenue,
      paymentMethod: methods[Math.floor(random() * methods.length)],
      paymentStatus: statuses[Math.floor(random() * statuses.length)],
      isReturned,
      returnReason: isReturned ? reasons[Math.floor(random() * reasons.length)] : undefined,
      returnDate: isReturned ? new Date(orderDate.getTime() + Math.floor(random() * 20) * 86400000) : undefined,
      deliveryDays: 1 + Math.floor(random() * 14),
      rating: hasRating ? 1 + Math.floor(random() * 5) : undefined,
      discountPercent,
    }

    if (i % 5000 === 0) {
      self.postMessage({ type: 'progress', percent: Math.round((i / total) * 100) })
    }
  }

  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    gross: Number(v.gross.toFixed(2)),
    net: Number(v.net.toFixed(2)),
  }))

  const aggregated = {
    dailyRevenue,
    monthlyByCategory: Object.fromEntries(categories.map((c) => [c, Array.from({ length: 24 }, () => 0)])),
    segmentCounts: { VIP: 0, Regular: 0, New: 0, 'At-Risk': 0, Churned: 0 },
    paymentBreakdown: Object.fromEntries(methods.map((m) => [m, { count: 0, revenue: 0, failed: 0 }])),
    returnRateByCategory: Object.fromEntries(categories.map((c) => [c, 0])),
    ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    countryRevenue: [{ country: 'United States', revenue: orders.reduce((s, o) => s + o.revenue, 0), orders: total }],
    topProducts: categories.map((category) => ({ category, orders: 0, revenue: 0, returnRate: 0 })),
  }

  self.postMessage({ type: 'progress', percent: 100 })
  self.postMessage({ type: 'done', orders, aggregated })
}
