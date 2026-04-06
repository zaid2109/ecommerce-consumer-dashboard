'use client'
import { memo, useRef, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
const DarkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#141820', border:'1px solid #1e2433', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
      <p style={{ color: payload[0]?.payload?.color, fontWeight:600 }}>{payload[0]?.name}: {payload[0]?.value?.toLocaleString()}</p>
    </div>
  )
}
export const OrderStatusDonut = memo(({ data }: { data: { name: string; value: number; color: string }[] }) => {
  const hasAnimated = useRef(false)
  useEffect(() => { hasAnimated.current = true }, [])
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-6" role="img" aria-label="Order status donut chart showing completed, pending and failed orders">
      <div style={{ position:'relative', width:160, height:160, flexShrink:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" isAnimationActive={!hasAnimated.current}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
            </Pie>
            <Tooltip content={<DarkTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', lineHeight:1 }}>{total.toLocaleString()}</span>
          <span style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>total</span>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {data.map(d => (
          <div key={d.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:d.color, flexShrink:0 }} />
              <span style={{ fontSize:12, color:'#9ca3af' }}>{d.name}</span>
            </div>
            <span style={{ fontSize:12, fontWeight:600, color:'#f1f5f9' }}>
              {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
OrderStatusDonut.displayName = 'OrderStatusDonut'
export default OrderStatusDonut
