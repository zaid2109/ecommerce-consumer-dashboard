'use client'

import type { ComponentType, ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { SparklineChart as DefaultSparklineChart } from '@/components/charts/SparklineChart'

type KPICardProps = {
  title: string
  value: string | number
  delta: number
  deltaLabel?: string
  ringPercent?: number
  sparklineData?: number[]
  sparklineColor?: string
  prefix?: string
  suffix?: string
  variant?: 'ring' | 'sparkline'
  icon?: ReactNode
  SparklineComponent?: ComponentType<{ data: number[]; color?: string; height?: number }>
}

export function KPICard({
  title,
  value,
  delta,
  deltaLabel,
  ringPercent,
  sparklineData,
  sparklineColor = '#6366f1',
  prefix = '',
  suffix = '',
  variant,
  icon,
  SparklineComponent,
}: KPICardProps) {
  const isUp = delta >= 0
  const circumference = 2 * Math.PI * 22
  const resolvedRing = ringPercent ?? (variant === 'ring' ? Math.max(0, Math.min(100, Math.abs(delta))) : undefined)
  const filled = ((resolvedRing ?? 0) / 100) * circumference
  const Chart = SparklineComponent ?? DefaultSparklineChart

  return (
    <div className="sc sc-interactive relative overflow-hidden" style={{ minHeight: 136 }}>
      {/* Subtle accent glow behind the ring / sparkline */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          background: `radial-gradient(ellipse at 90% 10%, ${sparklineColor}0d 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <div className="flex items-start justify-between gap-2" style={{ position: 'relative' }}>
        <p className="kpi-label">{title}</p>
        {icon && <span style={{ color: '#4b5563' }}>{icon}</span>}
      </div>

      <p className="kpi-value" style={{ position: 'relative' }}>{prefix}{value}{suffix}</p>

      <div className="flex items-center gap-2 mt-3" style={{ position: 'relative' }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            padding: '2px 7px', borderRadius: 5,
            background: isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            color: isUp ? '#4ade80' : '#f87171',
          }}
        >
          {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isUp ? '+' : ''}{Math.abs(delta).toFixed(1)}%
        </span>
        <span style={{ fontSize: 11, color: '#4b5563' }}>{deltaLabel ?? 'vs prev period'}</span>
      </div>

      {/* Ring chart */}
      {resolvedRing !== undefined && (
        <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" strokeWidth="5" stroke="#1e2433" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke={sparklineColor}
              strokeWidth="5"
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
              style={{ filter: `drop-shadow(0 0 4px ${sparklineColor}66)` }}
            />
            <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
              fontSize="10" fontWeight="700" fill="#94a3b8">
              {Math.round(resolvedRing)}%
            </text>
          </svg>
        </div>
      )}

      {/* Sparkline */}
      {resolvedRing === undefined && sparklineData && sparklineData.length > 0 && (
        <div style={{ position: 'absolute', bottom: 8, right: 8, width: 90, height: 36, opacity: 0.85 }}>
          <Chart data={sparklineData} color={sparklineColor} height={36} />
        </div>
      )}
    </div>
  )
}

export default KPICard
