'use client'

import { memo, useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type WeeklyPoint = { day: string; revenue: number; returns: number }

type WeeklyBarChartProps = {
  data: WeeklyPoint[]
}

export const WeeklyBarChart = memo(function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="40%">
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip
          content={(props) => (
            <SpireTooltip
              {...props}
              formatter={(value: number) => formatCurrency(value)}
            />
          )}
        />
        <Bar dataKey="revenue" name="Revenue" barSize={8} fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="returns" name="Returns" barSize={8} fill="#e2e8f0" radius={[4, 4, 0, 0]} isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

WeeklyBarChart.displayName = 'WeeklyBarChart'

export default WeeklyBarChart
