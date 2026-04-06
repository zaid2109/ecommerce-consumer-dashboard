'use client'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: 'rgba(248,113,113,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={24} style={{ color: '#f87171' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
          Something went wrong
        </p>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, maxWidth: 320 }}>
          {error.message ?? 'An unexpected error occurred loading this page.'}
        </p>
      </div>
      <button
        onClick={reset}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 8,
          background: '#1e2433', border: '1px solid #2d3748',
          color: '#9ca3af', fontSize: 13, cursor: 'pointer',
        }}
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  )
}
