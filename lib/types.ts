export interface Order {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  customerSegment: 'VIP' | 'Regular' | 'New' | 'At-Risk' | 'Churned'
  customerCity: string
  customerCountry: string
  orderDate: Date
  category: 'Electronics'|'Clothing'|'Home & Garden'|'Sports'|
            'Beauty'|'Books'|'Toys'|'Automotive'|'Food'|'Jewelry'
  productName: string
  quantity: number
  unitPrice: number
  revenue: number
  paymentMethod: 'Credit Card'|'Debit Card'|'UPI'|'Net Banking'|
                 'Wallet'|'Buy Now Pay Later'|'Cash on Delivery'
  paymentStatus: 'Completed'|'Pending'|'Failed'
  isReturned: boolean
  returnReason?: 'Defective'|'Wrong Item'|'Changed Mind'|'Size Issue'|'Not as Described'
  returnDate?: Date
  deliveryDays: number
  rating?: number
  discountPercent: number
}

export interface PreAggregated {
  dailyRevenue: { date: string; gross: number; net: number }[]        // 730 entries
  monthlyByCategory: Record<string, number[]>                         // category → 24 monthly values
  segmentCounts: Record<Order['customerSegment'], number>
  paymentBreakdown: Record<Order['paymentMethod'], { count: number; revenue: number; failed: number }>
  returnRateByCategory: Record<Order['category'], number>
  ratingDistribution: Record<string, number>                          // '1'..'5' → count
  countryRevenue: { country: string; revenue: number; orders: number }[]
  topProducts: { category: string; orders: number; revenue: number; returnRate: number }[]
}
