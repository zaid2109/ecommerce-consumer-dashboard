'use client'

import { memo } from 'react'
import { useTheme } from 'next-themes'

type CohortHeatmapProps = {
  data: number[][]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function bgColor(value: number, dark: boolean): string {
  if (dark) return `rgba(99,102,241,${Math.max(0.14, value / 100)})`
  return `rgba(99,102,241,${value / 100})`
}

export const CohortHeatmap = memo(function CohortHeatmap({ data }: CohortHeatmapProps) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return (
    <div className="overflow-x-auto">
      <table className="st w-full min-w-[640px] border-collapse" role="table" aria-label="Cohort retention heatmap table">
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs text-gray-500">Cohort</th>
            {Array.from({ length: 12 }, (_, i) => (
              <th scope="col" key={i} className="p-2 text-center text-xs text-gray-500">
                {i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, r) => (
            <tr key={r}>
              <td className="p-2 text-xs font-medium text-gray-700 dark:text-gray-200">{MONTHS[r]}</td>
              {row.map((value, c) => (
                <td key={c} className="p-1">
                  <div
                    title={`Month ${c}, Cohort ${MONTHS[r]}: ${value}%`}
                    className="h-7 w-full rounded text-center text-[10px] leading-7 text-gray-900 dark:text-white"
                    style={{
                      backgroundColor: bgColor(value, dark),
                      color: value > 50 ? '#fff' : undefined,
                    }}
                  >
                    {value}%
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

CohortHeatmap.displayName = 'CohortHeatmap'

export default CohortHeatmap
