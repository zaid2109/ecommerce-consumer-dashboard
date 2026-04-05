'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_PALETTE } from '@/lib/utils'

type Row = {
  category: string
  orders: number
  grossRevenue: number
  returnRate: number
  avgRating: number
  avgPrice: number
}

type CategoryRadarProps = {
  data: Row[]
}

export const CategoryRadar = memo(function CategoryRadar({ data }: CategoryRadarProps) {
  const hasAnimated = useRef(false)
  const [selected, setSelected] = useState<string[]>(() => data.slice(0, 3).map((d) => d.category))

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const metrics = useMemo(() => {
    const maxRevenue = Math.max(...data.map((d) => d.grossRevenue), 1)
    const maxOrders = Math.max(...data.map((d) => d.orders), 1)
    const maxPrice = Math.max(...data.map((d) => d.avgPrice), 1)
    const rows = selected.map((cat) => data.find((d) => d.category === cat)).filter(Boolean) as Row[]
    return rows.map((r) => [
      { metric: 'Revenue', value: (r.grossRevenue / maxRevenue) * 100, category: r.category },
      { metric: 'Orders', value: (r.orders / maxOrders) * 100, category: r.category },
      { metric: 'Avg Price', value: (r.avgPrice / maxPrice) * 100, category: r.category },
      { metric: 'Return Rate', value: r.returnRate * 100, category: r.category },
      { metric: 'Avg Rating', value: (r.avgRating / 5) * 100, category: r.category },
    ])
  }, [data, selected])

  const radarData = useMemo(() => {
    const base = ['Revenue', 'Orders', 'Avg Price', 'Return Rate', 'Avg Rating'].map((metric) => ({ metric })) as Array<
      { metric: string } & Record<string, number>
    >
    for (const series of metrics) {
      for (const p of series) {
        const target = base.find((b) => b.metric === p.metric)!
        target[p.category] = p.value
      }
    }
    return base
  }, [metrics])

  return (
    <div className="space-y-3">
      <select
        multiple
        value={selected}
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, 3)
          setSelected(values)
        }}
        className="h-24 w-full rounded-lg border border-[#e5e7eb] p-2 text-sm dark:border-[#2d3748] dark:bg-[#0f1117]"
      >
        {data.map((d) => (
          <option key={d.category} value={d.category}>
            {d.category}
          </option>
        ))}
      </select>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" />
          <Tooltip />
          {selected.map((cat, i) => (
            <Radar
              key={cat}
              dataKey={cat}
              stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              fillOpacity={0.2}
              isAnimationActive={!hasAnimated.current}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
})

CategoryRadar.displayName = 'CategoryRadar'

export default CategoryRadar


