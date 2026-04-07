'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type Row = { category: string; grossRevenue: number; returnsValue: number; netRevenue: number }

type CategoryMarginBarProps = { data: Row[] }

export const CategoryMarginBar = memo(function CategoryMarginBar({ data }: CategoryMarginBarProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ right: 80 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#6b7280' }} width={110} />
        <Tooltip content={(props) => <SpireTooltip {...props} formatter={(v: number) => formatCurrency(v)} />} />
        <Bar dataKey="grossRevenue" fill="#6366f1" isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="returnsValue" fill="#ef4444" isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

CategoryMarginBar.displayName = 'CategoryMarginBar'

export default CategoryMarginBar


