'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getColor, formatNumber } from '@/lib/utils'

type FrequencyHistogramProps = {
  data: { bucket: string; count: number }[]
}

export const FrequencyHistogram = memo(function FrequencyHistogram({ data }: FrequencyHistogramProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const colored = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        fill: i % 2 === 0 ? '#6366f1' : getColor(1),
      })),
    [data]
  )

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={colored}>
        <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip formatter={(value: number) => formatNumber(value)} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} isAnimationActive={!hasAnimated.current}>
          {colored.map((entry) => (
            <Cell key={entry.bucket} fill={entry.fill} />
          ))}
          <LabelList dataKey="count" position="top" formatter={(value: number) => formatNumber(value)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

FrequencyHistogram.displayName = 'FrequencyHistogram'

export default FrequencyHistogram


