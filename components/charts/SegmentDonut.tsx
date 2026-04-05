'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

type SegmentDonutProps = {
  data: { name: string; value: number; color: string }[]
}

export const SegmentDonut = memo(function SegmentDonut({ data }: SegmentDonutProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={80}
            outerRadius={130}
            isAnimationActive={!hasAnimated.current}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-900 text-lg font-semibold dark:fill-white">
            {total}
          </text>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2">
        {data.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${d.color}22`, color: d.color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
})

SegmentDonut.displayName = 'SegmentDonut'

export default SegmentDonut


