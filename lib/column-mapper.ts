import type { ColumnMapping } from './dataset-store'

type AnalysisMapping = Partial<Record<keyof ColumnMapping, string | null>>

const MAPPING_KEYS: (keyof ColumnMapping)[] = [
  'orderId','date','revenue','category','customerName','customerSegment','country','quantity','unitPrice',
  'paymentMethod','paymentStatus','isReturned','returnReason','rating','discount','productName',
]

export function normalizeColumnMapping(input: AnalysisMapping, availableColumns: string[]): ColumnMapping {
  const columnSet = new Set(availableColumns)
  const out = {} as ColumnMapping

  for (const key of MAPPING_KEYS) {
    const candidate = input[key]
    out[key] = candidate && columnSet.has(candidate) ? candidate : null
  }

  return out
}
