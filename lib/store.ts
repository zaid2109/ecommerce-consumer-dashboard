'use client'

import { create } from 'zustand'

const now = new Date()
const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())

export interface FilterState {
  dateRange: [Date, Date]
  categories: string[]
  segments: string[]
  countries: string[]
  paymentMethods: string[]
  activePage: string
}

export interface FilterActions {
  setDateRange: (range: [Date, Date]) => void
  setCategories: (v: string[]) => void
  setSegments: (v: string[]) => void
  setCountries: (v: string[]) => void
  setPaymentMethods: (v: string[]) => void
  setActivePage: (p: string) => void
  resetFilters: () => void
}

const initialState: FilterState = {
  dateRange: [twoYearsAgo, now],
  categories: [],
  segments: [],
  countries: [],
  paymentMethods: [],
  activePage: 'dashboard',
}

export const useFilterStore = create<FilterState & FilterActions>((set) => ({
  ...initialState,

  setDateRange: (range) => set({ dateRange: range }),
  setCategories: (v) => set({ categories: v }),
  setSegments: (v) => set({ segments: v }),
  setCountries: (v) => set({ countries: v }),
  setPaymentMethods: (v) => set({ paymentMethods: v }),
  setActivePage: (p) => set({ activePage: p }),
  resetFilters: () =>
    set({
      dateRange: [twoYearsAgo, now],
      categories: [],
      segments: [],
      countries: [],
      paymentMethods: [],
    }),
}))
