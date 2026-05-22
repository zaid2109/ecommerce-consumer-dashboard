'use client'

import { memo, useEffect, useRef } from 'react'
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

function formatDateLabel(dateStr: string, granularity: 'daily' | 'weekly' | 'monthly'): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`)
    if (granularity === 'monthly') return d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    if (granularity === 'weekly') return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export const RevenueLineChart = memo(function RevenueLineChart({ data, granularity }: RevenueLineChartProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <div>
      <ResponsiveContainer width="100%" height={264}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="rlc-gross" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.45} />
              <stop offset="60%"  stopColor="#6366f1" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rlc-net" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="60%"  stopColor="#a78bfa" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e2433" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
            tickFormatter={(v) => formatDateLabel(v, granularity)}
          />
          <YAxis
            width={54}
            tick={{ fontSize: 11, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />

          <Tooltip
            content={(props) => (
              <SpireTooltip
                active={props.active}
                payload={props.payload}
                label={props.label ? formatDateLabel(String(props.label), granularity) : undefined}
                formatter={(value: number) => formatCurrency(value)}
              />
            )}
            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.4 }}
          />

          <Area
            type="monotone"
            dataKey="gross"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#rlc-gross)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: '#0d0f14', strokeWidth: 2 }}
            isAnimationActive={!hasAnimated.current}
            name="Gross revenue"
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke="#a78bfa"
            strokeWidth={1.5}
            fill="url(#rlc-net)"
            dot={false}
            activeDot={{ r: 4, fill: '#a78bfa', stroke: '#0d0f14', strokeWidth: 2 }}
            isAnimationActive={!hasAnimated.current}
            name="Net revenue"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-5 mt-3 ml-14">
        <span className="flex items-center gap-2 text-[11px] text-[#4b5563]">
          <span className="w-8 h-[2px] rounded-full" style={{ background: '#6366f1' }} />
          Gross revenue
        </span>
        <span className="flex items-center gap-2 text-[11px] text-[#4b5563]">
          <span className="w-8 h-[1.5px] rounded-full" style={{ background: '#a78bfa' }} />
          Net revenue
        </span>
      </div>
    </div>
  )
})

RevenueLineChart.displayName = 'RevenueLineChart'
export default RevenueLineChart
