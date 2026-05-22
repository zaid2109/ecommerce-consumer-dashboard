'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type PaymentShareDonutProps = { data: { name: string; value: number }[] }

export const PaymentShareDonut = memo(function PaymentShareDonut({ data }: PaymentShareDonutProps) {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip
          content={(props) => (
            <SpireTooltip
              {...props}
              formatter={(v: number) =>
                `${v.toLocaleString()} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`
              }
            />
          )}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={72}
          outerRadius={112}
          paddingAngle={2}
          isAnimationActive={!hasAnimated.current}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              stroke="#141820"
              strokeWidth={2}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
})

PaymentShareDonut.displayName = 'PaymentShareDonut'
export default PaymentShareDonut
