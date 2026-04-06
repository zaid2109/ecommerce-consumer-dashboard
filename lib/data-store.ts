'use client'
import { useState, useEffect } from 'react'
import type { PreAggregated } from './types'

// Module-level cache so we only fetch once
let cachedAggregated: PreAggregated | null = null
let fetchPromise: Promise<PreAggregated> | null = null

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
