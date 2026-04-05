'use client'

import { memo, useEffect, useRef } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ReturnBySegmentBarProps = { data: { segment: string; returned: number; notReturned: number }[] }

export const ReturnBySegmentBar = memo(function ReturnBySegmentBar({ data }: ReturnBySegmentBarProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="segment" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="returned" fill="#ef4444" isAnimationActive={!hasAnimated.current} />
        <Bar dataKey="notReturned" fill="#10b981" isAnimationActive={!hasAnimated.current} />
      </BarChart>
    </ResponsiveContainer>
  )
})

ReturnBySegmentBar.displayName = 'ReturnBySegmentBar'

export default ReturnBySegmentBar


