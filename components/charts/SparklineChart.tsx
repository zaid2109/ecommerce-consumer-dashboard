'use client'

import { memo, useEffect, useId, useMemo, useRef } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type SparklineChartProps = {
  data: number[]
  color?: string
  height?: number
}

export const SparklineChart = memo(function SparklineChart({
  data,
  color = '#6366f1',
  height = 48,
}: SparklineChartProps) {
  const hasAnimated = useRef(false)
  const gradientId = useId()

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const chartData = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data]
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={!hasAnimated.current}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

SparklineChart.displayName = 'SparklineChart'

export default SparklineChart


