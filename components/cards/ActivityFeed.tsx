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
    <div className="h-full flex flex-col">
      <h3 className="sc-title mb-3.5">Recent activity</h3>
      <div className="flex-1 space-y-0">
        {events.slice(0, 7).map((event) => (
          <div key={event.id} className="flex items-start gap-3 border-b border-[#20293c] py-3.5 last:border-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-[11px] font-bold text-white flex items-center justify-center">
              {getInitials(event.text)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-[#e5e7eb] leading-snug">{event.text}</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">
                {mounted ? relativeTime(event.time) : event.time.toISOString().slice(0, 10)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityFeed

