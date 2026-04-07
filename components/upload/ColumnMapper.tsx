'use client'
import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react'
import type { ColumnMapping } from '@/lib/dataset-store'

interface ColumnMapperProps {
  analysis: {
    datasetType: string
    columnMapping: ColumnMapping
    insights: string[]
    missingColumns: string[]
    confidence: 'high' | 'medium' | 'low'
    columns: string[]
    rowCount: number
    fileName: string
  }
  onConfirm: (mapping: ColumnMapping) => void
  onBack: () => void
}

const MAPPING_LABELS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'orderId', label: 'Order ID', required: true },
  { key: 'date', label: 'Order Date', required: true },
  { key: 'revenue', label: 'Revenue / Amount', required: true },
  { key: 'category', label: 'Category', required: false },
  { key: 'customerName', label: 'Customer Name/ID', required: false },
  { key: 'customerSegment', label: 'Customer Segment', required: false },
  { key: 'country', label: 'Country / Region', required: false },
  { key: 'quantity', label: 'Quantity', required: false },
  { key: 'unitPrice', label: 'Unit Price', required: false },
  { key: 'paymentMethod', label: 'Payment Method', required: false },
  { key: 'paymentStatus', label: 'Payment Status', required: false },
  { key: 'isReturned', label: 'Return Flag', required: false },
  { key: 'rating', label: 'Rating / Score', required: false },
]

export function ColumnMapper({ analysis, onConfirm, onBack }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(analysis.columnMapping)
  const [showAll, setShowAll] = useState(false)
  const canProceed = Boolean(mapping.orderId && mapping.date && mapping.revenue)

  const visibleFields = showAll ? MAPPING_LABELS : MAPPING_LABELS.slice(0, 6)
  const confidenceColor = { high: '#4ade80', medium: '#fb923c', low: '#f87171' }[analysis.confidence]

  return (
    <div className="space-y-4">
      <div style={{ background: '#0f131b', borderRadius: 10, padding: '12px 14px', border: '1px solid #273149' }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[13px] font-semibold text-[#f1f5f9]">{analysis.datasetType}</p>
            <p className="text-[11px] text-[#6b7280] mt-0.5">{analysis.fileName} · {analysis.rowCount.toLocaleString()} rows</p>
          </div>
          <span
            style={{
              background: `rgba(${confidenceColor === '#4ade80' ? '74,222,128' : confidenceColor === '#fb923c' ? '251,146,60' : '248,113,113'},0.15)`,
              color: confidenceColor,
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {analysis.confidence} confidence
          </span>
        </div>

        <div className="space-y-1 mt-2">
          {analysis.insights?.slice(0, 2).map((insight, i) => (
            <p key={i} className="text-[11px] text-[#9ca3af] flex items-start gap-1.5">
              <span className="text-[#4ade80] mt-0.5 shrink-0">•</span>
              {insight}
            </p>
          ))}
        </div>
      </div>

      {analysis.missingColumns?.length > 0 && (
        <div style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ color: '#fb923c', marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12, color: '#fb923c', fontWeight: 500 }}>Missing columns: {analysis.missingColumns.join(', ')}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Dashboard will use defaults for these fields.</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#6b7280] mb-2">Column Mapping — review and correct if needed</p>
        <div className="space-y-2">
          {visibleFields.map(({ key, label, required }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-36 shrink-0">
                {mapping[key] ? (
                  <CheckCircle2 size={13} className="text-[#4ade80] shrink-0" />
                ) : (
                  <span style={{ width: 13, height: 13, borderRadius: '50%', border: `1px solid ${required ? '#fb923c' : '#1e2433'}`, flexShrink: 0, display: 'inline-block' }} />
                )}
                <span style={{ fontSize: 12, color: required ? '#d1d5db' : '#9ca3af' }}>
                  {label}{required ? <span style={{ color: '#f87171' }}> *</span> : null}
                </span>
              </div>

              <div className="relative flex-1">
                <select
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value || null }))}
                  className="ui-focus"
                  style={{ width: '100%', appearance: 'none', background: '#0d0f14', border: '1px solid #273149', borderRadius: 6, padding: '5px 28px 5px 10px', fontSize: 12, color: mapping[key] ? '#f1f5f9' : '#4b5563', cursor: 'pointer' }}
                >
                  <option value="">— not mapped —</option>
                  {analysis.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
              </div>
            </div>
          ))}
        </div>

        {!showAll ? (
          <button onClick={() => setShowAll(true)} className="ui-focus text-[11px] text-[#6b7280] hover:text-[#9ca3af] mt-2 transition">
            Show {MAPPING_LABELS.length - 6} more fields ↓
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="ui-focus" style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #273149', background: 'transparent', fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>
          Back
        </button>
        <button
          onClick={() => onConfirm(mapping)}
          disabled={!canProceed}
          className="ui-focus"
          style={{
            flex: 2,
            padding: '9px 0',
            borderRadius: 8,
            background: !canProceed ? '#1e2433' : '#4ade80',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: !canProceed ? '#4b5563' : '#0d0f14',
            cursor: !canProceed ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Build Dashboard →
        </button>
      </div>
    </div>
  )
}
