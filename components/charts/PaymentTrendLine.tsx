'use client'

import { memo, useEffect, useRef } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type PaymentTrendLineProps = { data: Array<Record<string, number | string>>; methods: string[] }

export const PaymentTrendLine = memo(function PaymentTrendLine({ data, methods }: PaymentTrendLineProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip content={(props) => <SpireTooltip {...props} />} />
        {methods.map((m, i) => (
          <Line key={m} dataKey={m} type="monotone" stroke={CHART_PALETTE[i % CHART_PALETTE.length]} dot={false} isAnimationActive={!hasAnimated.current} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
})

PaymentTrendLine.displayName = 'PaymentTrendLine'

export default PaymentTrendLine


