'use client'
import { usePathname } from 'next/navigation'
import { Search, Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchWithAuth } from '@/lib/auth-client'
import { withCsrfHeader } from '@/lib/csrf-client'

type AlertEvent = {
  id: string
  title: string
  message: string
  status: 'OPEN' | 'ACKNOWLEDGED'
}

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/customers': 'Customers',
  '/dashboard/orders': 'Orders',
  '/dashboard/products': 'Products',
  '/dashboard/returns': 'Returns',
  '/dashboard/payments': 'Payments',
  '/dashboard/settings': 'Settings',
}

interface HeaderProps { sidebarWidth: number }

export function Header({ sidebarWidth }: HeaderProps) {
  const pathname = usePathname()
  const [events, setEvents] = useState<AlertEvent[]>([])

  useEffect(() => {
    fetchWithAuth('/api/alerts/events', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setEvents((payload?.events ?? []).slice(0, 5))
      })
      .catch(() => {})
  }, [])

  const title = TITLES[pathname] ?? 'Dashboard'

  async function acknowledgeAlert(eventId: string) {
    await fetchWithAuth(`/api/alerts/events/${eventId}/ack`, {
      method: 'POST',
      headers: withCsrfHeader(),
    })
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'ACKNOWLEDGED' } : e))
    )
  }

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 h-16 transition-all duration-300 bg-page-light/95 dark:bg-page-dark/95 border-b border-border-dark backdrop-blur-md"
      style={{ left: sidebarWidth }}
    >
      <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-tx-primary">{title}</h1>

      <div className="flex items-center gap-2.5">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
          <label htmlFor="header-search-input" className="sr-only">Search</label>
          <input
            id="header-search-input"
            readOnly
            placeholder="Search..."
            className="ui-focus h-9 w-[220px] rounded-full pl-8 pr-4 text-[13px] bg-[#1a2233] text-tx-primary placeholder:text-tx-muted border border-[#2a3246] cursor-pointer"
          />
        </div>

        {/* Alert bell */}
        <div className="group relative">
          <button
            aria-label="View notifications"
            className="ui-focus relative w-9 h-9 rounded-full flex items-center justify-center text-tx-secondary hover:bg-[#1e2433] transition-colors"
          >
            <Bell size={16} />
            {events.some((e) => e.status === 'OPEN') && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
            )}
          </button>
          <div className="pointer-events-none absolute right-0 top-11 hidden w-80 rounded-lg border border-[#2a3246] bg-[#0f131b] p-3 opacity-0 shadow-lg transition group-hover:pointer-events-auto group-hover:block group-hover:opacity-100">
            <p className="mb-2 text-xs font-semibold text-tx-primary">Alerts</p>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-md border border-[#2a3246] p-2">
                  <p className="text-xs font-medium text-tx-primary">{event.title}</p>
                  <p className="text-[11px] text-tx-secondary">{event.message}</p>
                  {event.status === 'OPEN' ? (
                    <button
                      type="button"
                      onClick={() => void acknowledgeAlert(event.id)}
                      className="mt-1 rounded border border-[#2a3246] px-2 py-0.5 text-[10px] text-tx-secondary"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <p className="mt-1 text-[10px] text-emerald-300">Acknowledged</p>
                  )}
                </div>
              ))}
              {!events.length && (
                <p className="text-xs text-tx-secondary">No alerts</p>
              )}
            </div>
          </div>
        </div>

        {/* User avatar */}
        <button
          aria-label="User menu"
          className="ui-focus h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[12px] font-bold text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          JD
        </button>
      </div>
    </header>
  )
}
