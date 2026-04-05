'use client'

export const SpireTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-card border p-3 text-[12px] min-w-[140px]"
      style={{
        background: 'rgba(20,24,32,0.96)',
        borderColor: '#2a3246',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <p className="text-tx-secondary dark:text-tx-muted mb-2 font-semibold tracking-[0.01em]">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-5 py-0.5">
          <span className="flex items-center gap-1.5 text-[#cbd5e1]">
            <span className="w-2 h-2 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.06)]" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-[#f8fafc] tabular-nums">
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default SpireTooltip

