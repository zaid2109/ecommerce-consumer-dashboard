import type { FilterState } from '@/lib/store'

export type SavedFilterPayload = {
  dateRange: [string, string]
  categories: string[]
  segments: string[]
  countries: string[]
  paymentMethods: string[]
}

export function toSavedFilterPayload(state: FilterState): SavedFilterPayload {
  return {
    dateRange: [state.dateRange[0].toISOString(), state.dateRange[1].toISOString()],
    categories: state.categories,
    segments: state.segments,
    countries: state.countries,
    paymentMethods: state.paymentMethods,
  }
}

export function fromSavedFilterPayload(payload: SavedFilterPayload): Omit<FilterState, 'activePage'> {
  return {
    dateRange: [new Date(payload.dateRange[0]), new Date(payload.dateRange[1])],
    categories: payload.categories ?? [],
    segments: payload.segments ?? [],
    countries: payload.countries ?? [],
    paymentMethods: payload.paymentMethods ?? [],
  }
}
