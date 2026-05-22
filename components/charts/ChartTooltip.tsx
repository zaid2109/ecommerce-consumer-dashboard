'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const SpireTooltip = (props: any) => {
  const { active, payload, label, formatter } = props
  if (!active || !payload?.length) return null

  return (
    <div
      style={{
        background: 'rgba(13,15,20,0.97)',
        border: '1px solid #2a3246',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        minWidth: 148,
        fontSize: 12,
      }}
    >
      {label && (
        <p style={{ color: '#6b7280', fontWeight: 600, letterSpacing: '0.01em', marginBottom: 8, fontSize: 11 }}>
          {label}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {(payload as any[]).map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: p.color ?? p.stroke ?? '#6366f1',
                boxShadow: `0 0 0 2px ${(p.color ?? '#6366f1')}33`,
                flexShrink: 0,
              }} />
              {p.name}
            </span>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
              {formatter ? formatter(p.value, p.dataKey) : (p.value as number)?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SpireTooltip
