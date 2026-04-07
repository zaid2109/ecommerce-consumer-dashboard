'use client'

import { memo, useEffect, useRef } from 'react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SpireTooltip from './ChartTooltip'

type ReturnRateOverTimeProps = { data: { month: string; rate: number }[] }

export const ReturnRateOverTime = memo(function ReturnRateOverTime({ data }: ReturnRateOverTimeProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip content={(props) => <SpireTooltip {...props} />} />
        <Area dataKey="rate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} isAnimationActive={!hasAnimated.current} />
        {data[6] ? <ReferenceLine x={data[6].month} strokeDasharray="4 4" label="Summer Sale" /> : null}
        {data[14] ? <ReferenceLine x={data[14].month} strokeDasharray="4 4" label="Holiday Push" /> : null}
        {data[20] ? <ReferenceLine x={data[20].month} strokeDasharray="4 4" label="Flash Deal" /> : null}
      </AreaChart>
    </ResponsiveContainer>
  )
})

ReturnRateOverTime.displayName = 'ReturnRateOverTime'

export default ReturnRateOverTime


