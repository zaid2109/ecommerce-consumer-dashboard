'use client'
import { Loader2, FileText, Brain } from 'lucide-react'

const STEPS = [
  { key: 'parsing', icon: FileText, label: 'Parsing file', sub: 'Reading rows and columns...' },
  { key: 'analyzing', icon: Brain, label: 'AI analyzing columns', sub: 'Claude is mapping your data...' },
]

export function UploadProgress({ step }: { step: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="py-6">
      <div className="flex flex-col gap-4">
        {STEPS.map((s, i) => {
          const isDone = i < currentIdx
          const isActive = i === currentIdx
          return (
            <div key={s.key} className="flex items-center gap-2.5">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isDone ? '#06351b' : isActive ? '#1a2233' : '#0d0f14',
                  border: `1px solid ${isDone || isActive ? '#4ade80' : '#273149'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isActive ? (
                  <Loader2 size={16} className="text-[#4ade80] animate-spin" />
                ) : isDone ? (
                  <span style={{ color: '#4ade80', fontSize: 14 }}>✓</span>
                ) : s.icon ? (
                  <s.icon size={16} style={{ color: '#4b5563' }} />
                ) : null}
              </div>
              <div>
                  <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.25, color: isActive ? '#f1f5f9' : isDone ? '#9ca3af' : '#4b5563' }}>{s.label}</p>
                {isActive && s.sub ? <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.sub}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
