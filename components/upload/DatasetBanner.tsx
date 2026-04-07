'use client'
import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { useDatasetStore } from '@/lib/dataset-store'
import { fetchWithAuth } from '@/lib/auth-client'

export function DatasetBanner() {
  const { meta, clearDataset } = useDatasetStore()
  const [latestDataset, setLatestDataset] = useState<{ name: string; rowCount: number; createdAt: string; status: string } | null>(null)

  useEffect(() => {
    let mounted = true
    fetchWithAuth('/api/datasets')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.datasets?.length) return
        const d = payload.datasets[0] as { name: string; rowCount: number; createdAt: string; status: string }
        setLatestDataset(d)
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [meta?.uploadedAt])

  if (!meta && !latestDataset) return null

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(74,222,128,0.08), rgba(74,222,128,0.04))',
        border: '1px solid rgba(74,222,128,0.28)',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}
    >
      <FileText size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, letterSpacing: '0.01em' }}>
          {meta?.datasetType ?? 'Uploaded Dataset'}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
          {meta
            ? `${meta.fileName} · ${meta.rowCount.toLocaleString()} rows · uploaded ${new Date(meta.uploadedAt).toLocaleDateString()}`
            : `${latestDataset?.name ?? 'Dataset'} · ${(latestDataset?.rowCount ?? 0).toLocaleString()} rows · status ${latestDataset?.status?.toLowerCase() ?? 'unknown'}`}
        </span>
      </div>
      <button
        onClick={clearDataset}
        title="Switch back to demo data"
        className="ui-focus"
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', background: 'rgba(15,23,42,0.22)', border: '1px solid rgba(71,85,105,0.35)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
      >
        <X size={13} />
        Reset to demo
      </button>
    </div>
  )
}
