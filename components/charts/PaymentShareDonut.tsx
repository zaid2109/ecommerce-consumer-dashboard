'use client'

import { memo, useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'

type PaymentShareDonutProps = { data: { name: string; value: number }[] }

export const PaymentShareDonut = memo(function PaymentShareDonut({ data }: PaymentShareDonutProps) {
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setAnimate(false), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} isAnimationActive={animate}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
})

PaymentShareDonut.displayName = 'PaymentShareDonut'

export default PaymentShareDonut


