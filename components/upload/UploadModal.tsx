'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Upload, AlertCircle, Loader2 } from 'lucide-react'
import { useDatasetStore } from '@/lib/dataset-store'
import type { ColumnMapping } from '@/lib/dataset-store'
import { ColumnMapper } from './ColumnMapper'
import { UploadProgress } from './UploadProgress'
import { withCsrfHeader } from '@/lib/csrf-client'
import { fetchWithAuth } from '@/lib/auth-client'

interface UploadModalProps {
  onClose: () => void
}

interface AnalyzeResult {
  datasetType: string
  columnMapping: ColumnMapping
  insights: string[]
  suggestedKPIs?: { label: string; value: string; delta: string; positive: boolean }[]
  dateFormat?: string | null
  currencySymbol?: string
  missingColumns: string[]
  confidence: 'high' | 'medium' | 'low'
}

type DatasetCreateResponse = {
  dataset: { id: string; status: string }
  job: { id: string; status: string }
  idempotentReplay?: boolean
}

type JobStatusResponse = {
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  error?: string | null
  result?: { datasetId?: string }
}

function formatUploadError(message: string): string {
  const clean = message.trim()
  if (!clean) return 'Upload failed. Please try again.'
  if (clean.includes('invalid x-api-key') || clean.includes('authentication_error')) {
    return 'AI analysis is not configured. Add a valid ANTHROPIC_API_KEY in .env.local, then restart the server.'
  }
  if (clean.length > 220) return `${clean.slice(0, 217)}...`
  return clean
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function UploadModal({ onClose }: UploadModalProps) {
  const [dragging, setDragging] = useState(false)
  const [aiResult, setAiResult] = useState<(AnalyzeResult & { rowCount: number; fileName: string; columns: string[] }) | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const store = useDatasetStore()

  useEffect(() => {
    const el = document.getElementById('upload-modal-title')
    el?.focus()
  }, [])

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

  const pollJobUntilComplete = useCallback(async (jobId: string): Promise<JobStatusResponse> => {
    const maxAttempts = 180
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusRes = await fetchWithAuth(`/api/jobs/${jobId}/status`, { cache: 'no-store' })
      if (!statusRes.ok) {
        const err = await statusRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to read ingestion status')
      }
      const statusPayload = (await statusRes.json()) as JobStatusResponse
      if (statusPayload.status === 'COMPLETED') return statusPayload
      if (statusPayload.status === 'FAILED') {
        throw new Error(statusPayload.error ?? 'Ingestion failed')
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error('Ingestion timed out')
  }, [])

  const processFile = useCallback(async (file: File) => {
    const allowedTypes = ['.csv', '.xlsx', '.tsv', '.json']
    const filename = file.name.toLowerCase()
    const isAllowed = allowedTypes.some(ext => filename.endsWith(ext))

    if (!isAllowed) {
      store.setUploadError(
        `Unsupported file type "${file.name.split('.').pop()}". ` +
        `Please upload a CSV, Excel (.xlsx), TSV, or JSON file.`
      )
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      store.setUploadError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
        `Maximum allowed size is 50MB.`
      )
      return
    }

    if (file.size < 100) {
      store.setUploadError('File appears to be empty. Please check your file and try again.')
      return
    }

    store.setIsUploading(true)
    store.setUploadError(null)

    try {
      store.setUploadStep('parsing')
      const formData = new FormData()
      formData.append('file', file)

      const parseRes = await fetchWithAuth('/api/parse-file', {
        method: 'POST',
        body: formData,
        headers: withCsrfHeader(),
      })
      if (!parseRes.ok) {
        const err = await parseRes.json()
        throw new Error(err.error ?? 'Failed to parse file')
      }

      const { columns, rowCount, sample, fileName, parseFingerprint, rawArtifactKey, processedArtifactKey, processedMetrics } = await parseRes.json()
      const parseBaseFingerprint = String(parseFingerprint ?? '')
      if (!parseBaseFingerprint) {
        throw new Error('Parser did not return a fingerprint')
      }

      store.setUploadStep('analyzing')
      const analyzeRes = await fetchWithAuth('/api/analyze-dataset', {
        method: 'POST',
        headers: withCsrfHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ columns, sample, fileName, rowCount }),
      })

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json()
        throw new Error(err.error ?? 'AI analysis failed')
      }

      const analysisRaw = (await analyzeRes.json()) as AnalyzeResult
      const analysis: AnalyzeResult = {
        ...analysisRaw,
        insights: analysisRaw.insights ?? [],
        missingColumns: analysisRaw.missingColumns ?? [],
      }
      store.setUploadStep('queueing')
      const mappingFingerprint = await sha256Hex(JSON.stringify(analysis.columnMapping))
      const idempotencyKey = `${parseBaseFingerprint}:${mappingFingerprint}`

      const datasetsRes = await fetchWithAuth('/api/datasets', {
        method: 'POST',
        headers: withCsrfHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: fileName.replace(/\.[^.]+$/, ''),
          sourceType: 'UPLOAD',
          rowCount,
          columnCount: columns.length,
          schema: {
            columns,
            columnMapping: analysis.columnMapping,
          },
          idempotencyKey,
          rawArtifactKey,
          processedArtifactKey,
          processedMetrics: {
            ...(processedMetrics ?? {}),
            dateFormat: analysis.dateFormat ?? null,
            currencySymbol: analysis.currencySymbol ?? '$',
          },
        }),
      })
      if (!datasetsRes.ok) {
        const err = await datasetsRes.json()
        throw new Error(err.error ?? 'Failed to create dataset')
      }
      const created = (await datasetsRes.json()) as DatasetCreateResponse
      if (!created.job?.id) {
        throw new Error('Missing ingestion job id from dataset create response')
      }

      store.setUploadStep('processing')
      await pollJobUntilComplete(created.job.id)

      setAiResult({ ...analysis, rowCount, fileName, columns })
      store.setColumnMapping(analysis.columnMapping)
      store.setMeta({
        fileName,
        rowCount,
        columns,
        uploadedAt: new Date().toISOString(),
        datasetType: analysis.datasetType,
        datasetId: created.dataset.id,
        jobId: created.job.id,
        status: 'READY',
        aiInsights: analysis.insights ?? [],
        suggestedKPIs: analysis.suggestedKPIs ?? [],
      })

      store.setUploadStep('mapping')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      store.setUploadError(formatUploadError(message))
      store.setIsUploading(false)
    }
  }, [MAX_FILE_SIZE, pollJobUntilComplete, store])

  const handleConfirmMapping = useCallback(async (mapping: ColumnMapping) => {
    try {
      store.setUploadStep('transforming')
      store.setColumnMapping(mapping)

      await new Promise((resolve) => setTimeout(resolve, 50))
      store.setIsUploading(false)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transformation failed'
      store.setUploadError(formatUploadError(message))
      store.setIsUploading(false)
    }
  }, [store, onClose])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="upload-modal-title" className="animate-in fade-in zoom-in-95 duration-200" style={{ background: '#141820', border: '1px solid #273149', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2433]">
          <div>
            <h2 id="upload-modal-title" tabIndex={-1} className="text-[16px] font-semibold tracking-[-0.01em] text-[#f1f5f9]">Upload Dataset</h2>
            <p className="text-[12px] text-[#6b7280] mt-0.5">CSV, Excel, TSV, or JSON — AI will auto-configure your dashboard</p>
          </div>
          <button aria-label="Close upload modal" onClick={onClose} className="ui-focus w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:bg-[#1e2433] hover:text-[#f1f5f9] transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {store.uploadError ? (
            <div className="flex items-start gap-3 p-3 rounded-lg mb-4 bg-red-900/20 border border-red-500/30">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-red-300">Upload failed</p>
                <p className="text-[12px] text-red-400/80 mt-0.5">{store.uploadError}</p>
              </div>
              <button aria-label="Dismiss upload error" onClick={() => { store.setUploadError(null); store.setUploadStep('idle') }} className="ui-focus ml-auto text-red-400 hover:text-red-300">
                <X size={14} />
              </button>
            </div>
          ) : null}

          {store.uploadStep === 'idle' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#4ade80' : '#2a3246'}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(74,222,128,0.06)' : 'rgba(13,15,20,0.45)', transform: dragging ? 'translateY(-1px)' : 'translateY(0)', transition: 'all 0.2s' }}
            >
              <div className="w-12 h-12 rounded-full bg-[#1a2233] border border-[#2a3246] flex items-center justify-center mx-auto mb-3"><Upload size={20} className="text-[#4ade80]" /></div>
              <p className="text-[14px] font-medium text-[#f1f5f9] mb-1">Drop your file here</p>
              <p className="text-[12px] text-[#6b7280]">or click to browse — CSV, XLSX, TSV, JSON</p>
              <p className="text-[11px] text-[#4b5563] mt-3">Large files supported · AI auto-detects column types</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.tsv,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file) }} />
            </div>
          ) : null}

          {(store.uploadStep === 'parsing' || store.uploadStep === 'analyzing') ? <UploadProgress step={store.uploadStep} /> : null}

          {store.uploadStep === 'mapping' && aiResult ? (
            <ColumnMapper analysis={aiResult} onConfirm={handleConfirmMapping} onBack={() => store.setUploadStep('idle')} />
          ) : null}

          {store.uploadStep === 'transforming' ? (
            <div className="flex flex-col items-center py-10 gap-4">
              <Loader2 size={32} className="text-[#4ade80] animate-spin" />
              <p className="text-[13px] text-[#9ca3af]">Processing your data...</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
