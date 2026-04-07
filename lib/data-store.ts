'use client'
import { useState, useEffect } from 'react'
import type { Order, PreAggregated } from './types'

// Module-level cache so we only fetch once
let cachedAggregated: PreAggregated | null = null
let fetchPromise: Promise<PreAggregated> | null = null
let cachedOrders: Order[] | null = null
let fetchOrdersPromise: Promise<Order[]> | null = null

export function getAggregatedData(): Promise<PreAggregated> {
  if (cachedAggregated) return Promise.resolve(cachedAggregated)
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('/data/aggregated.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load dashboard data')
      return res.json()
    })
    .then(data => {
      cachedAggregated = data
      return data
    })

  return fetchPromise
}

export function useAggregatedData() {
  const [data, setData] = useState<PreAggregated | null>(cachedAggregated)
  const [loading, setLoading] = useState(!cachedAggregated)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedAggregated) {
      setData(cachedAggregated)
      setLoading(false)
      return
    }
    getAggregatedData()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return { data, loading, error }
}

export function getOrdersData(): Promise<Order[]> {
  if (cachedOrders) return Promise.resolve(cachedOrders)
  if (fetchOrdersPromise) return fetchOrdersPromise

  fetchOrdersPromise = fetch('/data/orders.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load order data')
      return res.json()
    })
    .then((rows: Array<Omit<Order, 'orderDate' | 'returnDate'> & { orderDate: string; returnDate?: string }>) => {
      cachedOrders = rows.map((row) => ({
        ...row,
        orderDate: new Date(row.orderDate),
        returnDate: row.returnDate ? new Date(row.returnDate) : undefined,
      }))
      return cachedOrders
    })

  return fetchOrdersPromise
}

export function useOrdersData() {
  const [data, setData] = useState<Order[] | null>(cachedOrders)
  const [loading, setLoading] = useState(!cachedOrders)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedOrders) {
      setData(cachedOrders)
      setLoading(false)
      return
    }
    getOrdersData()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return { data, loading, error }
}
