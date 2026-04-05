'use client'

import { memo } from 'react'

type Box = { category: string; min: number; q1: number; median: number; q3: number; max: number }
type PriceBoxPlotProps = { data: Box[] }

export const PriceBoxPlot = memo(function PriceBoxPlot({ data }: PriceBoxPlotProps) {
  const width = 980
  const height = 300
  const pad = 30
  const max = Math.max(...data.map((d) => d.max), 1)
  const col = (width - pad * 2) / Math.max(data.length, 1)
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full min-w-[900px]">
        {data.map((d, i) => {
          const x = pad + i * col + col / 2
          return (
            <g key={d.category}>
              <line x1={x} y1={y(d.min)} x2={x} y2={y(d.max)} stroke="#6b7280" />
              <line x1={x - 10} y1={y(d.min)} x2={x + 10} y2={y(d.min)} stroke="#6b7280" />
              <line x1={x - 10} y1={y(d.max)} x2={x + 10} y2={y(d.max)} stroke="#6b7280" />
              <rect x={x - 14} y={y(d.q3)} width={28} height={Math.max(2, y(d.q1) - y(d.q3))} fill="#6366f1" fillOpacity="0.25" stroke="#6366f1" />
              <line x1={x - 14} y1={y(d.median)} x2={x + 14} y2={y(d.median)} stroke="#6366f1" strokeWidth={2} />
              <text x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
                {d.category}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
})

PriceBoxPlot.displayName = 'PriceBoxPlot'

export default PriceBoxPlot


