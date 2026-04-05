'use client'

import { memo, useEffect, useRef } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

type DayOfWeekChartProps = {
  data: { day: string; orders: number }[]
}

export const DayOfWeekChart = memo(function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="day" />
        <Radar
          dataKey="orders"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.3}
          isAnimationActive={!hasAnimated.current}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  )
})

DayOfWeekChart.displayName = 'DayOfWeekChart'

export default DayOfWeekChart


