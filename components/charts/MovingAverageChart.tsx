'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type MovingAverageChartProps = {
  data: { date: string; raw: number; ma7: number; ma30: number }[]
}

export const MovingAverageChart = memo(function MovingAverageChart({ data }: MovingAverageChartProps) {
  const hasAnimated = useRef(false)
  const [mode, setMode] = useState<'ma7' | 'ma30'>('ma7')

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-[#e5e7eb] p-1 dark:border-[#2d3748]">
        <button
          onClick={() => setMode('ma7')}
          className={`rounded px-2 py-1 text-xs ${mode === 'ma7' ? 'bg-[#6366f1] text-white' : 'text-gray-600 dark:text-gray-300'}`}
        >
          7-day MA
        </button>
        <button
          onClick={() => setMode('ma30')}
          className={`rounded px-2 py-1 text-xs ${mode === 'ma30' ? 'bg-[#6366f1] text-white' : 'text-gray-600 dark:text-gray-300'}`}
        >
          30-day MA
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip content={(props) => <SpireTooltip {...props} formatter={(v: number) => formatCurrency(v)} />} />
          <Line
            type="monotone"
            dataKey="raw"
            stroke="#9ca3af"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={!hasAnimated.current}
          />
          <Line
            type="monotone"
            dataKey={mode}
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={!hasAnimated.current}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

MovingAverageChart.displayName = 'MovingAverageChart'

export default MovingAverageChart


