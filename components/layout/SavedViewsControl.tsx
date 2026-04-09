'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { fetchWithAuth } from '@/lib/auth-client'
import { withCsrfHeader } from '@/lib/csrf-client'
import { useFilterStore } from '@/lib/store'
import { fromSavedFilterPayload, toSavedFilterPayload, type SavedFilterPayload } from '@/lib/saved-view-filters'
import { useSavedViewsStore, type SavedView } from '@/lib/saved-views-store'

type SavedViewApi = SavedView & {
  filters: SavedFilterPayload
}

export function SavedViewsControl() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { views, setViews, loading, setLoading, error, setError } = useSavedViewsStore()
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM'>('PRIVATE')
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const applySavedFilters = useFilterStore((s) => s.applySavedFilters)

  const activeToken = searchParams.get('view') ?? ''

  const loadViews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/saved-views?page=${encodeURIComponent(pathname)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load saved views')
      const payload = (await res.json()) as { views: SavedViewApi[] }
      setViews(payload.views)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load views')
    } finally {
      setLoading(false)
    }
  }, [pathname, setError, setLoading, setViews])

  useEffect(() => {
    void loadViews()
  }, [loadViews])

  useEffect(() => {
    if (!activeToken || !views.length) return
    const matched = views.find((v) => v.shareToken === activeToken) as SavedViewApi | undefined
    if (!matched) return
    applySavedFilters(fromSavedFilterPayload(matched.filters))
  }, [activeToken, views, applySavedFilters])

  async function saveCurrentView() {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    const res = await fetchWithAuth('/api/saved-views', {
      method: 'POST',
      headers: withCsrfHeader({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: trimmed,
        pagePath: pathname,
        visibility,
        filters: toSavedFilterPayload(filterState),
      }),
    })
    if (!res.ok) {
      setError('Unable to save view')
      return
    }
    setName('')
    await loadViews()
  }

  async function applyView(view: SavedViewApi) {
    applySavedFilters(fromSavedFilterPayload(view.filters))
    const next = new URLSearchParams(searchParams.toString())
    next.set('view', view.shareToken)
    router.replace(`${pathname}?${next.toString()}`)
  }

  async function pinView(view: SavedViewApi) {
    await fetchWithAuth(`/api/saved-views/${view.id}`, {
      method: 'PATCH',
      headers: withCsrfHeader({ 'content-type': 'application/json' }),
      body: JSON.stringify({ isPinned: !view.isPinned }),
    })
    await loadViews()
  }

  async function deleteView(view: SavedViewApi) {
    await fetchWithAuth(`/api/saved-views/${view.id}`, {
      method: 'DELETE',
      headers: withCsrfHeader(),
    })
    await loadViews()
  }

  const sortedViews = useMemo(() => [...views], [views]) as SavedViewApi[]

  return (
    <section className="sc mb-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Save current filters as view..."
          className="ui-focus h-9 min-w-[240px] rounded-md border border-[#2a3246] bg-[#0f131b] px-3 text-sm text-tx-primary"
        />
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value === 'TEAM' ? 'TEAM' : 'PRIVATE')}
          className="ui-focus h-9 rounded-md border border-[#2a3246] bg-[#0f131b] px-2 text-sm text-tx-primary"
        >
          <option value="PRIVATE">Private</option>
          <option value="TEAM">Team</option>
        </select>
        <button
          type="button"
          onClick={() => void saveCurrentView()}
          className="rounded-md border border-[#2a3246] px-3 py-1.5 text-xs text-tx-secondary hover:bg-white/5"
        >
          Save view
        </button>
        <button
          type="button"
          onClick={() => void loadViews()}
          className="rounded-md border border-[#2a3246] px-3 py-1.5 text-xs text-tx-secondary hover:bg-white/5"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="text-xs text-tx-secondary">Loading saved views...</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {sortedViews.map((view) => (
          <div key={view.id} className="flex items-center gap-1 rounded-full border border-[#2a3246] px-2 py-1 text-xs">
            <button type="button" onClick={() => void applyView(view)} className="text-tx-primary">
              {view.name}
            </button>
            <button type="button" onClick={() => void pinView(view)} className="text-tx-secondary">
              {view.isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              onClick={() => {
                const link = `${window.location.origin}${pathname}?view=${encodeURIComponent(view.shareToken)}`
                void navigator.clipboard.writeText(link)
              }}
              className="text-tx-secondary"
            >
              Share
            </button>
            <button type="button" onClick={() => void deleteView(view)} className="text-red-300">
              Delete
            </button>
          </div>
        ))}
        {!sortedViews.length && !loading ? <p className="text-xs text-tx-secondary">No saved views yet.</p> : null}
      </div>
    </section>
  )
}

export default SavedViewsControl
