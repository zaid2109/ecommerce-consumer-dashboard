'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '@/lib/utils'

type CLVHistogramProps = {
  data: { bin: string; count: number }[]
}

export const CLVHistogram = memo(function CLVHistogram({ data }: CLVHistogramProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="bin" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip formatter={(v: number) => formatNumber(v)} />
        <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} isAnimationActive={!hasAnimated.current}>
          <LabelList dataKey="count" position="top" formatter={(v: number) => formatNumber(v)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

CLVHistogram.displayName = 'CLVHistogram'

export default CLVHistogram


