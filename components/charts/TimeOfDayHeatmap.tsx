'use client'

import { memo } from 'react'
import { Fragment } from 'react'

type TimeOfDayHeatmapProps = {
  data: number[][]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const TimeOfDayHeatmap = memo(function TimeOfDayHeatmap({ data }: TimeOfDayHeatmapProps) {
  const max = Math.max(...data.flat(), 1)

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[64px_repeat(24,minmax(24px,1fr))] gap-1">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[10px] text-gray-500">
            {h}
          </div>
        ))}
        {DAYS.map((day, r) => (
          <Fragment key={day}>
            <div key={`${day}-label`} className="py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              {day}
            </div>
            {Array.from({ length: 24 }, (_, c) => {
              const value = data[r]?.[c] ?? 0
              const intensity = value / max
              return (
                <div
                  key={`${day}-${c}`}
                  title={`${day}, ${c}:00 - ${value} orders`}
                  className="h-5 rounded"
                  style={{ backgroundColor: `rgba(99,102,241,${Math.max(0.06, intensity)})` }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
})

TimeOfDayHeatmap.displayName = 'TimeOfDayHeatmap'

export default TimeOfDayHeatmap


