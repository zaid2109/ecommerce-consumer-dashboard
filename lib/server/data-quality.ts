import crypto from 'crypto'
import type { ColumnMapping } from '@/lib/dataset-store'

export type QualityResult = {
  validRows: Record<string, unknown>[]
  rejectedRows: Array<Record<string, unknown> & { __reject_reason: string }>
  confidence: number
  mappingFingerprint: string
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

function isNumericLike(v: unknown): boolean {
  if (!hasValue(v)) return false
  const n = Number.parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n)
}

function isDateLike(v: unknown): boolean {
  if (!hasValue(v)) return false
  const d = new Date(String(v))
  return Number.isFinite(d.getTime())
}

function rejectReason(row: Record<string, unknown>, mapping: ColumnMapping): string | null {
  if (mapping.orderId && !hasValue(row[mapping.orderId])) return 'Missing orderId'
  if (mapping.date && !isDateLike(row[mapping.date])) return 'Invalid or missing date'
  if (mapping.revenue && !isNumericLike(row[mapping.revenue])) return 'Invalid revenue'
  if (mapping.quantity && !isNumericLike(row[mapping.quantity])) return 'Invalid quantity'
  if (mapping.unitPrice && !isNumericLike(row[mapping.unitPrice])) return 'Invalid unitPrice'
  if (mapping.customerName && !hasValue(row[mapping.customerName])) return 'Missing customerName'
  if (mapping.productName && !hasValue(row[mapping.productName])) return 'Missing productName'
  return null
}

function scoreConfidence(total: number, rejected: number, mapping: ColumnMapping): number {
  if (total <= 0) return 0
  const coverageKeys = Object.values(mapping).filter(Boolean).length
  const coverageRatio = coverageKeys / 16
  const validRatio = (total - rejected) / total
  const score = validRatio * 0.75 + coverageRatio * 0.25
  return Number((Math.max(0, Math.min(1, score)) * 100).toFixed(2))
}

function fingerprintMapping(mapping: ColumnMapping): string {
  const stable = JSON.stringify(
    Object.fromEntries(
      Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b))
    )
  )
  return crypto.createHash('sha256').update(stable).digest('hex')
}

export function evaluateDatasetQuality(rows: Record<string, unknown>[], mapping: ColumnMapping): QualityResult {
  const validRows: Record<string, unknown>[] = []
  const rejectedRows: Array<Record<string, unknown> & { __reject_reason: string }> = []

  for (const row of rows) {
    const reason = rejectReason(row, mapping)
    if (reason) {
      rejectedRows.push({ ...row, __reject_reason: reason })
      continue
    }
    validRows.push(row)
  }

  return {
    validRows,
    rejectedRows,
    confidence: scoreConfidence(rows.length, rejectedRows.length, mapping),
    mappingFingerprint: fingerprintMapping(mapping),
  }
}

export function toRejectCsv(rows: Array<Record<string, unknown> & { __reject_reason: string }>): string {
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  )
  const escape = (input: unknown): string => {
    const raw = String(input ?? '')
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }
  const header = columns.join(',')
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(',')).join('\n')
  return `${header}\n${body}`
}
