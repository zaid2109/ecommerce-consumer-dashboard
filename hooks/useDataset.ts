'use client'

import { useEffect, useState } from 'react'
import { useDatasetStore } from '@/lib/dataset-store'
import { useAggregatedData, useOrdersData } from '@/lib/data-store'
import type { DatasetMeta } from '@/lib/dataset-store'
import type { Order, PreAggregated } from '@/lib/types'
import { fetchWithAuth } from '@/lib/auth-client'

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
  },
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  countryRevenue: [],
  topProducts: [],
}

export function useDataset(): {
  aggregated: PreAggregated
  isUploaded: boolean
  meta: DatasetMeta | null
  orders: Order[]
} {
  const { data } = useAggregatedData()
  const { data: ordersData } = useOrdersData()
  const { meta } = useDatasetStore()
  const [backendOrders, setBackendOrders] = useState<Order[] | null>(null)
  const [backendAggregated, setBackendAggregated] = useState<PreAggregated | null>(null)

  useEffect(() => {
    let mounted = true
    fetchWithAuth('/api/datasets', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (payload) => {
        const latest = payload?.datasets?.[0]
        if (!mounted || !latest?.id) return
        if (latest.status !== 'READY') {
          setBackendAggregated(null)
          setBackendOrders(null)
          return
        }

        const processedRes = await fetchWithAuth(`/api/datasets/${latest.id}/data`, { cache: 'no-store' })
        if (!mounted) return

        if (processedRes.ok) {
          const processed = (await processedRes.json()) as {
            orders: Array<Omit<Order, 'orderDate' | 'returnDate'> & { orderDate: string; returnDate?: string }>
            aggregated: PreAggregated
          }
          setBackendAggregated(processed.aggregated)
          setBackendOrders(
            processed.orders.map((row) => ({
              ...row,
              orderDate: new Date(row.orderDate),
              returnDate: row.returnDate ? new Date(row.returnDate) : undefined,
            }))
          )
          return
        }

        const [aggRes, ordersRes] = await Promise.all([
          fetch('/data/aggregated.json', { cache: 'no-store' }),
          fetch('/data/orders.json', { cache: 'no-store' }),
        ])
        if (!mounted || !aggRes.ok || !ordersRes.ok) return

        const [aggJson, ordersJson] = await Promise.all([
          aggRes.json() as Promise<PreAggregated>,
          ordersRes.json() as Promise<Array<Omit<Order, 'orderDate' | 'returnDate'> & { orderDate: string; returnDate?: string }>>,
        ])
        setBackendAggregated(aggJson)
        setBackendOrders(
          ordersJson.map((row) => ({
            ...row,
            orderDate: new Date(row.orderDate),
            returnDate: row.returnDate ? new Date(row.returnDate) : undefined,
          }))
        )
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [meta?.uploadedAt])

  const isUploaded = backendAggregated !== null || backendOrders !== null

  return {
    aggregated: backendAggregated ?? data ?? EMPTY_AGGREGATED,
    isUploaded,
    meta,
    orders: backendOrders ?? ordersData ?? [],
  }
}
