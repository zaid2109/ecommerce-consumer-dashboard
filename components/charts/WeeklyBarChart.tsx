'use client'

import { memo, useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type WeeklyPoint = { day: string; revenue: number; returns: number }

export const WeeklyBarChart = memo(function WeeklyBarChart({ data }: { data: WeeklyPoint[] }) {
  const hasAnimated = useRef(false)

  useEffect(() => { hasAnimated.current = true }, [])

  // Highlight the peak revenue day
  const maxRevDay = data.reduce((best, d) => (d.revenue > best.revenue ? d : best), data[0] ?? { day: '', revenue: 0, returns: 0 })

  return (
    <ResponsiveContainer width="100%" height={264}>
      <BarChart data={data} barCategoryGap="38%" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e2433" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#4b5563' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          width={50}
          tick={{ fontSize: 11, fill: '#4b5563' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          content={(props) => (
            <SpireTooltip {...props} formatter={(v: number) => formatCurrency(v)} />
          )}
          cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }}
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          barSize={10}
          radius={[4, 4, 0, 0]}
          isAnimationActive={!hasAnimated.current}
        >
          {data.map((entry) => (
            <Cell
              key={entry.day}
              fill={entry.day === maxRevDay.day ? '#6366f1' : '#4f46e5'}
              opacity={entry.day === maxRevDay.day ? 1 : 0.65}
            />
          ))}
        </Bar>
        <Bar
          dataKey="returns"
          name="Returns"
          barSize={10}
          radius={[4, 4, 0, 0]}
          fill="#ef4444"
          fillOpacity={0.35}
          isAnimationActive={!hasAnimated.current}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})

WeeklyBarChart.displayName = 'WeeklyBarChart'
export default WeeklyBarChart
