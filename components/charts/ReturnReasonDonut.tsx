'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'

type ReturnReasonDonutProps = { data: { name: string; value: number }[] }

export const ReturnReasonDonut = memo(function ReturnReasonDonut({ data }: ReturnReasonDonutProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} isAnimationActive={!hasAnimated.current}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
})

ReturnReasonDonut.displayName = 'ReturnReasonDonut'

export default ReturnReasonDonut


