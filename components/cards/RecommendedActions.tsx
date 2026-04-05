'use client'

import {
  AlertTriangle,
  CreditCard,
  Crown,
  Globe,
  LineChart,
  Repeat,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import type { Action } from '@/lib/recommendations'

const iconMap: Record<string, LucideIcon> = {
  RotateCcw,
  Globe,
  Crown,
  CreditCard,
  Repeat,
  LineChart,
  AlertTriangle,
}

function DynamicIcon({ name, size }: { name: string; size: number }) {
  const Icon = iconMap[name] ?? AlertTriangle
  return <Icon size={size} />
}

type RecommendedActionsProps = {
  actions: Action[]
}

export function RecommendedActions({ actions }: RecommendedActionsProps) {
  return (
    <div className="sc">
      <h3 className="sc-title mb-4">Recommended actions</h3>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-card-border dark:border-card-border-dark"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                action.priority === 'High'
                  ? 'bg-red-100 dark:bg-red-900/20 text-danger'
                  : action.priority === 'Medium'
                    ? 'bg-amber-100 dark:bg-amber-900/20 text-warning'
                    : 'bg-green-100 dark:bg-green-900/20 text-success'
              }`}
            >
              <DynamicIcon name={action.icon} size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-tx-primary dark:text-tx-inverse">{action.title}</p>
                <span
                  className={`pill text-[10px] ${
                    action.priority === 'High'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : action.priority === 'Medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  }`}
                >
                  {action.priority}
                </span>
              </div>
              <p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">{action.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RecommendedActions

