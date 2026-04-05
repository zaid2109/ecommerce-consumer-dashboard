'use client'

import { memo } from 'react'
import { Fragment } from 'react'

type RefundHeatmapProps = { data: { category: string; values: number[] }[] }

export const RefundHeatmap = memo(function RefundHeatmap({ data }: RefundHeatmapProps) {
  const max = Math.max(...data.flatMap((d) => d.values), 1)
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-[130px_repeat(24,minmax(24px,1fr))] gap-1">
        <div />
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="text-center text-[10px] text-gray-500">{i + 1}</div>
        ))}
        {data.map((row) => (
          <Fragment key={row.category}>
            <div key={`${row.category}-label`} className="py-1 text-xs font-medium">{row.category}</div>
            {row.values.map((v, i) => (
              <div
                key={`${row.category}-${i}`}
                title={`${row.category} month ${i + 1}: ${v}`}
                className="h-5 rounded"
                style={{ backgroundColor: `rgba(239,68,68,${Math.min(1, v / max)})` }}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
})

RefundHeatmap.displayName = 'RefundHeatmap'

export default RefundHeatmap


