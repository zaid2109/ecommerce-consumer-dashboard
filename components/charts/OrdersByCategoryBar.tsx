'use client'
import { memo, useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartTheme } from '@/hooks/useChartTheme'
import SpireTooltip from './ChartTooltip'
export const OrdersByCategoryBar = memo(({ data }: { data: { name: string; orders: number }[] }) => {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])
  const { textColor } = useChartTheme()
  return (
    <div role="img" aria-label="Orders by category bar chart showing top categories">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart layout="vertical" data={data} margin={{ top:0, right:4, left:0, bottom:0 }} barCategoryGap="25%">
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:textColor }} />
          <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fontSize:11, fill:textColor }} />
          <Tooltip content={(props) => <SpireTooltip {...props} />} cursor={{ fill:'rgba(255,255,255,0.02)' }} />
          <Bar dataKey="orders" fill="#60a5fa" barSize={10} radius={[0,3,3,0]} isAnimationActive={!hasAnimated.current} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
OrdersByCategoryBar.displayName = 'OrdersByCategoryBar'
export default OrdersByCategoryBar
