'use client'
import { memo, useRef, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartTheme } from '@/hooks/useChartTheme'
import SpireTooltip from './ChartTooltip'
export const OrdersAreaChart = memo(({ data }: { data: { date: string; orders: number }[] }) => {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])
  const { gridColor, textColor } = useChartTheme()
  return (
    <div role="img" aria-label="Orders over time area chart showing order volume trend">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top:4, right:4, left:0, bottom:0 }}>
          <defs>
            <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="0" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:textColor, fontFamily:'Inter' }} interval={14} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize:10, fill:textColor }} width={35} />
          <Tooltip content={(props) => <SpireTooltip {...props} />} cursor={{ stroke:'#4ade80', strokeWidth:1, strokeDasharray:'4 4' }} />
          <Area type="monotone" dataKey="orders" stroke="#4ade80" strokeWidth={2} fill="url(#ordersGrad)" dot={false} isAnimationActive={!hasAnimated.current} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})
OrdersAreaChart.displayName = 'OrdersAreaChart'
export default OrdersAreaChart
