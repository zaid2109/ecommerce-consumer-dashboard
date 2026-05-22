'use client'

import { useAggregatedData, useOrdersData } from '@/lib/data-store'
import type { Order, PreAggregated } from '@/lib/types'

const EMPTY_AGGREGATED: PreAggregated = {
  dailyRevenue: [],
  monthlyByCategory: {},
  segmentCounts: { VIP: 0, Regular: 0, New: 0, 'At-Risk': 0, Churned: 0 },
  paymentBreakdown: {
    'Credit Card': { count: 0, revenue: 0, failed: 0 },
    'Debit Card': { count: 0, revenue: 0, failed: 0 },
    UPI: { count: 0, revenue: 0, failed: 0 },
    'Net Banking': { count: 0, revenue: 0, failed: 0 },
    Wallet: { count: 0, revenue: 0, failed: 0 },
    'Buy Now Pay Later': { count: 0, revenue: 0, failed: 0 },
    'Cash on Delivery': { count: 0, revenue: 0, failed: 0 },
  },
  returnRateByCategory: {
    Electronics: 0, Clothing: 0, 'Home & Garden': 0, Sports: 0,
    Beauty: 0, Books: 0, Toys: 0, Automotive: 0, Food: 0, Jewelry: 0,
  },
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  countryRevenue: [],
  topProducts: [],
}

export function useDataset(): {
  aggregated: PreAggregated
  isUploaded: boolean
  meta: null
  orders: Order[]
  datasetError: string | null
} {
  const { data, error: aggError } = useAggregatedData()
  const { data: ordersData, error: ordersError } = useOrdersData()

  return {
    aggregated: data ?? EMPTY_AGGREGATED,
    isUploaded: false,
    meta: null,
    orders: ordersData ?? [],
    datasetError: aggError ?? ordersError ?? null,
  }
}
