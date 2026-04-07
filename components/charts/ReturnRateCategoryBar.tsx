'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SpireTooltip from './ChartTooltip'

type ReturnRateCategoryBarProps = { data: { category: string; rate: number }[] }

export const ReturnRateCategoryBar = memo(function ReturnRateCategoryBar({ data }: ReturnRateCategoryBarProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={(props) => <SpireTooltip {...props} />} />
        <ReferenceLine y={12} stroke="#111827" strokeDasharray="3 3" />
        <Bar dataKey="rate" isAnimationActive={!hasAnimated.current}>
          {data.map((d) => (
            <Cell key={d.category} fill={d.rate > 12 ? '#ef4444' : '#10b981'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

ReturnRateCategoryBar.displayName = 'ReturnRateCategoryBar'

export default ReturnRateCategoryBar


