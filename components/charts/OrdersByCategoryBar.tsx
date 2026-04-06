'use client'
import { memo, useRef, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useChartTheme } from '@/hooks/useChartTheme'
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#141820', border:'1px solid #1e2433', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
      <p style={{ color:'#9ca3af', marginBottom:4 }}>{label}</p>
      <p style={{ color:'#60a5fa', fontWeight:600 }}>{payload[0]?.value?.toLocaleString()} orders</p>
    </div>
  )
}
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
          <Tooltip content={<DarkTooltip />} cursor={{ fill:'rgba(255,255,255,0.02)' }} />
          <Bar dataKey="orders" fill="#60a5fa" barSize={10} radius={[0,3,3,0]} isAnimationActive={!hasAnimated.current} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
OrdersByCategoryBar.displayName = 'OrdersByCategoryBar'
export default OrdersByCategoryBar
