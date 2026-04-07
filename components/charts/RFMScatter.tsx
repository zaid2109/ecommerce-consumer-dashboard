'use client'

import { memo, useEffect, useRef } from 'react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type ScatterPoint = {
  name: string
  segment: string
  frequency: number
  monetary: number
  recency: number
}

type RFMScatterProps = {
  data: ScatterPoint[]
}

const SEGMENT_COLORS: Record<string, string> = {
  VIP: '#6366f1',
  Regular: '#8b5cf6',
  New: '#06b6d4',
  'At-Risk': '#f59e0b',
  Churned: '#ef4444',
}

export const RFMScatter = memo(function RFMScatter({ data }: RFMScatterProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const grouped = Object.keys(SEGMENT_COLORS).map((segment) => ({
    segment,
    data: data.filter((d) => d.segment === segment),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart>
        <CartesianGrid />
        <XAxis type="number" dataKey="frequency" name="Orders" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis type="number" dataKey="monetary" name="Spend" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <ZAxis type="number" dataKey="recency" range={[30, 180]} />
        <Tooltip
          content={(props) => (
            <SpireTooltip
              {...props}
              formatter={(value: number, key: string) => (key === 'monetary' ? formatCurrency(value) : value)}
            />
          )}
          cursor={{ strokeDasharray: '3 3' }}
          labelFormatter={(_, payload) => {
            const point = payload?.[0]?.payload as ScatterPoint | undefined
            return point ? `${point.name} • ${point.segment}` : ''
          }}
        />
        {grouped.map((g) => (
          <Scatter
            key={g.segment}
            name={g.segment}
            data={g.data}
            fill={SEGMENT_COLORS[g.segment]}
            isAnimationActive={!hasAnimated.current}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
})

RFMScatter.displayName = 'RFMScatter'

export default RFMScatter


