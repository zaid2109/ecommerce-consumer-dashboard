'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type CategoryDonutPoint = { name: string; value: number; color: string }

type CategoryDonutChartProps = {
  data: CategoryDonutPoint[]
  centerLabel?: string
}

export const CategoryDonutChart = memo(function CategoryDonutChart({
  data,
  centerLabel,
}: CategoryDonutChartProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip content={(props) => <SpireTooltip {...props} formatter={(value: number) => formatCurrency(value)} />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          isAnimationActive={!hasAnimated.current}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        {centerLabel ? (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
            <tspan x="50%" dy="-8" fontSize="22" fontWeight="700" fill="#f1f5f9">
              {centerLabel.replace('★', '')}
            </tspan>
            <tspan x="50%" dy="18" fontSize="11" fill="#64748b">
              avg rating
            </tspan>
          </text>
        ) : null}
      </PieChart>
    </ResponsiveContainer>
  )
})

CategoryDonutChart.displayName = 'CategoryDonutChart'

export default CategoryDonutChart


