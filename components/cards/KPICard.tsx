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
  const circumference = 2 * Math.PI * 20
  const resolvedRing = ringPercent ?? (variant === 'ring' ? Math.max(0, Math.min(100, Math.abs(delta))) : undefined)
  const filled = ((resolvedRing ?? 0) / 100) * circumference
  const Chart = SparklineComponent ?? DefaultSparklineChart

  return (
    <div className="sc sc-interactive relative min-h-[130px]">
      <div className="flex items-start justify-between gap-2.5">
        <p className="kpi-label">{title}</p>
        {icon ? <span className="text-tx-muted dark:text-tx-muted">{icon}</span> : null}
      </div>

      <p className="kpi-value">{prefix}{value}{suffix}</p>

      <div className="flex items-center gap-2 mt-3">
        <span className={isUp ? 'delta-up' : 'delta-down'}>
          {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isUp ? '+' : ''}{Math.abs(delta).toFixed(1)}%
        </span>
        <span className="text-[11px] text-tx-muted dark:text-tx-muted">
          {deltaLabel ?? 'Last 3 weeks'}
        </span>
      </div>

      {resolvedRing !== undefined ? (
        <div className="absolute bottom-4 right-4">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="20" fill="none" strokeWidth="5" className="stroke-border-light dark:stroke-border-dark" />
            <circle
              cx="26"
              cy="26"
              r="20"
              fill="none"
              stroke="#6366f1"
              strokeWidth="5"
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
            <text x="26" y="26" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" className="fill-tx-secondary dark:fill-tx-muted">
              {Math.round(resolvedRing)}%
            </text>
          </svg>
        </div>
      ) : (
        sparklineData && sparklineData.length > 0 && (
          <div className="absolute bottom-3 right-4 w-[84px] h-[34px] opacity-90">
            <Chart data={sparklineData} color={sparklineColor} height={34} />
          </div>
        )
      )}
    </div>
  )
}

export default KPICard
