'use client'

import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/utils'

type ActivityEvent = {
  id: string
  type: 'order' | 'return' | 'vip'
  text: string
  time: Date
}

type ActivityFeedProps = {
  events: ActivityEvent[]
}

function getInitials(text: string): string {
  const tokens = text.split(' ').filter(Boolean)
  return `${tokens[0]?.[0] ?? 'A'}${tokens[1]?.[0] ?? 'U'}`.toUpperCase()
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div>
      <h3 className="sc-title mb-3.5">Recent activity</h3>
      {events.slice(0, 7).map((event) => (
        <div key={event.id} className="flex items-start gap-3 border-b border-[#20293c] py-2.5 last:border-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[10px] font-bold text-white flex items-center justify-center">
            {getInitials(event.text)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-tx-primary dark:text-tx-inverse leading-snug">{event.text}</p>
            <p className="mt-0.5 text-[11px] text-tx-muted">
              {mounted ? relativeTime(event.time) : event.time.toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ActivityFeed

