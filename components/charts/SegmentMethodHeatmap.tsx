'use client'

import { memo } from 'react'

type SegmentMethodHeatmapProps = {
  methods: string[]
  rows: { segment: string; values: number[] }[]
}

export const SegmentMethodHeatmap = memo(function SegmentMethodHeatmap({ methods, rows }: SegmentMethodHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="st w-full min-w-[700px]" role="table" aria-label="Segment by payment method heatmap table">
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs text-gray-500">Segment</th>
            {methods.map((m) => (
              <th scope="col" key={m} className="p-2 text-center text-xs text-gray-500">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.segment}>
              <td className="p-2 text-sm font-medium">{row.segment}</td>
              {row.values.map((v, i) => {
                const opacity = Math.max(0.08, v / 100)
                const darkText = opacity < 0.45
                return (
                  <td key={`${row.segment}-${i}`} className="p-1">
                    <div className={`rounded py-2 text-center text-xs font-medium ${darkText ? 'text-gray-800' : 'text-white'}`} style={{ backgroundColor: `rgba(99,102,241,${opacity})` }}>
                      {v.toFixed(1)}%
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

SegmentMethodHeatmap.displayName = 'SegmentMethodHeatmap'

export default SegmentMethodHeatmap
