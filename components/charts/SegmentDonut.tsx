'use client'

import { memo, useEffect, useRef } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import SpireTooltip from './ChartTooltip'

type SegmentDonutProps = {
  data: { name: string; value: number; color: string }[]
}

export const SegmentDonut = memo(function SegmentDonut({ data }: SegmentDonutProps) {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ResponsiveContainer width="100%" height={280}>
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
            innerRadius={80}
            outerRadius={120}
            paddingAngle={2}
            isAnimationActive={!hasAnimated.current}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="#141820" strokeWidth={2} />
            ))}
          </Pie>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
            <tspan x="50%" dy="-7" fontSize="22" fontWeight="800" fill="#f1f5f9">
              {total.toLocaleString()}
            </tspan>
            <tspan x="50%" dy="18" fontSize="10" fill="#6b7280" letterSpacing="0.06em">
              CUSTOMERS
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.map((d) => (
          <span
            key={d.name}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              borderRadius: 999, padding: '3px 10px',
              background: `${d.color}18`, color: d.color,
              fontSize: 11, fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
})

SegmentDonut.displayName = 'SegmentDonut'
export default SegmentDonut
