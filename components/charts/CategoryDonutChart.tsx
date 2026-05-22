'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import SpireTooltip from './ChartTooltip'

type CategoryDonutPoint = { name: string; value: number; color: string }

export const CategoryDonutChart = memo(function CategoryDonutChart({
  data,
  centerLabel,
}: {
  data: CategoryDonutPoint[]
  centerLabel?: string
}) {
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
              formatter={(value: number) =>
                `${value.toLocaleString()} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`
              }
            />
          )}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={76}
          outerRadius={118}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={!hasAnimated.current}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.color}
              stroke="#141820"
              strokeWidth={2}
            />
          ))}
        </Pie>

        {centerLabel && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
            <tspan x="50%" dy="-9" fontSize="26" fontWeight="800" fill="#f1f5f9">
              {centerLabel.replace('★', '')}
            </tspan>
            <tspan x="50%" dy="20" fontSize="10" fill="#6b7280" letterSpacing="0.06em">
              AVG RATING
            </tspan>
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  )
})

CategoryDonutChart.displayName = 'CategoryDonutChart'
export default CategoryDonutChart
