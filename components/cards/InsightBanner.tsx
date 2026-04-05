'use client'

import type { Insight } from '@/lib/insights'

type InsightBannerProps = {
  insights: Insight[]
}

export function InsightBanner({ insights }: InsightBannerProps) {
  return (
    <div className="rounded-card border border-indigo-200/60 dark:border-indigo-500/20 bg-gradient-to-r from-indigo-50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{insights[0]?.emoji}</span>
        <div>
          <p className="text-[13px] font-medium text-indigo-900 dark:text-indigo-200 leading-relaxed">
            {insights[0]?.text}
          </p>
          {insights[1] && (
            <p className="text-[12px] text-indigo-700/70 dark:text-indigo-300/70 mt-1">
              {insights[1].text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default InsightBanner

