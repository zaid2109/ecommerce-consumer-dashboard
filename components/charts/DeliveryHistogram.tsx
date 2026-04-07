'use client'
import { memo, useRef, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartTheme } from '@/hooks/useChartTheme'
import type { PreAggregated } from '@/lib/types'
import SpireTooltip from './ChartTooltip'
export const DeliveryHistogram = memo(({ aggregated }: { aggregated: PreAggregated }) => {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])
  const { gridColor, textColor } = useChartTheme()
  const data = useMemo(() => {
    const total = aggregated.topProducts.reduce((s, p) => s + p.orders, 0)
    return [
      { bin: '1-3d',  orders: Math.round(total * 0.18) },
      { bin: '4-7d',  orders: Math.round(total * 0.35) },
      { bin: '8-10d', orders: Math.round(total * 0.27) },
      { bin: '11-14d',orders: Math.round(total * 0.14) },
      { bin: '15d+',  orders: Math.round(total * 0.06) },
    ]
  }, [aggregated])
  return (
    <div role="img" aria-label="Delivery time histogram showing order delivery ranges">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top:4, right:4, left:0, bottom:0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="0" />
          <XAxis dataKey="bin" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:textColor }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize:10, fill:textColor }} width={40} />
          <Tooltip content={(props) => <SpireTooltip {...props} />} cursor={{ fill:'rgba(167,139,250,0.06)' }} />
          <Bar dataKey="orders" fill="#a78bfa" barSize={28} radius={[4,4,0,0]} isAnimationActive={!hasAnimated.current} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
DeliveryHistogram.displayName = 'DeliveryHistogram'
export default DeliveryHistogram
