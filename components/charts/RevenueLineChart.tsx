'use client'

import { memo, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type RevenuePoint = { date: string; gross: number; net: number }

type RevenueLineChartProps = {
  data: RevenuePoint[]
  granularity: 'daily' | 'weekly' | 'monthly'
}

export const RevenueLineChart = memo(function RevenueLineChart({
  data,
}: RevenueLineChartProps) {
  const hasAnimated = useRef(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={resolvedTheme === 'dark' ? '#1e2130' : '#f1f5f9'} />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
          <Tooltip
            content={(props) => (
              <SpireTooltip
                {...props}
                formatter={(value: number) => formatCurrency(value)}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="gross"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#grossGradient)"
            dot={false}
            isAnimationActive={!hasAnimated.current}
            name="Website sales"
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#netGradient)"
            dot={false}
            isAnimationActive={!hasAnimated.current}
            name="In store sales"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 ml-2">
        <span className="flex items-center gap-1.5 text-[12px] text-tx-secondary dark:text-tx-muted">
          <span className="w-3 h-0.5 bg-[#6366f1] rounded-full inline-block" />
          Website sales
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-tx-secondary dark:text-tx-muted">
          <span className="w-3 h-0.5 bg-[#8b5cf6] rounded-full inline-block" />
          In store sales
        </span>
      </div>
    </div>
  )
})

RevenueLineChart.displayName = 'RevenueLineChart'

export default RevenueLineChart


