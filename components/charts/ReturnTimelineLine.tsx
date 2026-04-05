'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { Line, LineChart, ResponsiveContainer, ReferenceDot, Tooltip, XAxis, YAxis } from 'recharts'

type ReturnTimelineLineProps = { data: { day: number; count: number }[] }

export const ReturnTimelineLine = memo(function ReturnTimelineLine({ data }: ReturnTimelineLineProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const peak = useMemo(() => [...data].sort((a, b) => b.count - a.count)[0], [data])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Line dataKey="count" stroke="#6366f1" dot={false} isAnimationActive={!hasAnimated.current} />
        {peak ? <ReferenceDot x={peak.day} y={peak.count} r={5} fill="#ef4444" label={`Peak Day ${peak.day}`} /> : null}
      </LineChart>
    </ResponsiveContainer>
  )
})

ReturnTimelineLine.displayName = 'ReturnTimelineLine'

export default ReturnTimelineLine


