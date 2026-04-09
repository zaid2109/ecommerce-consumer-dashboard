'use client'

import { create } from 'zustand'

export type SavedView = {
  id: string
  name: string
  pagePath: string
  visibility: 'PRIVATE' | 'TEAM'
  isPinned: boolean
  shareToken: string
  createdAt: string
  updatedAt: string
}

type SavedViewsState = {
  views: SavedView[]
  loading: boolean
  error: string | null
  setViews: (views: SavedView[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useSavedViewsStore = create<SavedViewsState>((set) => ({
  views: [],
  loading: false,
  error: null,
  setViews: (views) => set({ views }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
