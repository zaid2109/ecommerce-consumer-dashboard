'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SpireTooltip from './ChartTooltip'

type AvgTransactionBarProps = { data: { method: string; value: number }[] }

export const AvgTransactionBar = memo(function AvgTransactionBar({ data }: AvgTransactionBarProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="method" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={(props) => <SpireTooltip {...props} />} />
        <Bar dataKey="value" fill="#6366f1" isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

AvgTransactionBar.displayName = 'AvgTransactionBar'

export default AvgTransactionBar


