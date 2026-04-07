'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SpireTooltip from './ChartTooltip'

type FailureRateBarProps = { data: { method: string; failureRate: number }[]; benchmark: number }

export const FailureRateBar = memo(function FailureRateBar({ data, benchmark }: FailureRateBarProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="method" width={120} />
        <Tooltip content={(props) => <SpireTooltip {...props} />} />
        <ReferenceLine x={benchmark} stroke="#111827" strokeDasharray="3 3" />
        <Bar dataKey="failureRate" fill="#ef4444" isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

FailureRateBar.displayName = 'FailureRateBar'

export default FailureRateBar


