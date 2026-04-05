'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'

type CategoryAreaChartProps = {
  data: Array<Record<string, number | string>>
  categories: string[]
}

export const CategoryAreaChart = memo(function CategoryAreaChart({ data, categories }: CategoryAreaChartProps) {
  const hasAnimated = useRef(false)
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c, true]))
  )

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const activeCategories = useMemo(() => categories.filter((c) => visible[c]), [categories, visible])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category, i) => (
          <label key={category} className="inline-flex items-center gap-1 rounded border border-[#e5e7eb] px-2 py-1 text-xs dark:border-[#2d3748]">
            <input
              type="checkbox"
              checked={visible[category]}
              onChange={() => setVisible((p) => ({ ...p, [category]: !p[category] }))}
            />
            <span style={{ color: CHART_PALETTE[i % CHART_PALETTE.length] }}>{category}</span>
          </label>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip />
          <Legend />
          {activeCategories.map((category, i) => (
            <Area
              key={category}
              dataKey={category}
              type="monotone"
              stackId="cat"
              stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              isAnimationActive={!hasAnimated.current}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})

CategoryAreaChart.displayName = 'CategoryAreaChart'

export default CategoryAreaChart


