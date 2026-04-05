'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'

type SegmentRevenueBarProps = {
  data: { month: string; VIP: number; Regular: number; New: number; 'At-Risk': number }[]
}

export const SegmentRevenueBar = memo(function SegmentRevenueBar({ data }: SegmentRevenueBarProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Bar dataKey="VIP" stackId="seg" fill="#6366f1" isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="Regular" stackId="seg" fill="#8b5cf6" isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="New" stackId="seg" fill="#06b6d4" isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="At-Risk" stackId="seg" fill="#f59e0b" isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

SegmentRevenueBar.displayName = 'SegmentRevenueBar'

export default SegmentRevenueBar


