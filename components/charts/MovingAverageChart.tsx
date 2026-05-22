'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type MovingAverageChartProps = {
  data: { date: string; raw: number; ma7: number; ma30: number }[]
}

function fmtDate(s: string) {
  try {
    return new Date(`${s}T00:00:00`).toLocaleString('en-US', { month: 'short', day: 'numeric' })
  } catch { return s }
}

export const MovingAverageChart = memo(function MovingAverageChart({ data }: MovingAverageChartProps) {
  const hasAnimated = useRef(false)
  const [mode, setMode] = useState<'ma7' | 'ma30'>('ma7')
  useEffect(() => { hasAnimated.current = true }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #2a3246', padding: 3, gap: 2, alignSelf: 'flex-start' }}>
        {(['ma7', 'ma30'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
              background: mode === m ? '#6366f1' : 'transparent',
              color: mode === m ? '#fff' : '#6b7280',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {m === 'ma7' ? '7-day' : '30-day'}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={288}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1e2433" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
            tickFormatter={fmtDate}
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
                label={props.label ? fmtDate(String(props.label)) : undefined}
                formatter={(v: number) => formatCurrency(v)}
              />
            )}
            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeOpacity: 0.4 }}
          />
          <Line
            type="monotone"
            dataKey="raw"
            stroke="#2a3246"
            strokeWidth={1}
            strokeDasharray="4 3"
            dot={false}
            name="Daily"
            isAnimationActive={!hasAnimated.current}
          />
          <Line
            type="monotone"
            dataKey={mode}
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: '#0d0f14', strokeWidth: 2 }}
            name={mode === 'ma7' ? '7-day MA' : '30-day MA'}
            isAnimationActive={!hasAnimated.current}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

MovingAverageChart.displayName = 'MovingAverageChart'
export default MovingAverageChart
