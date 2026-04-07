'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useDataset } from '@/hooks/useDataset'
import { withCsrfHeader } from '@/lib/csrf-client'
import { fetchWithAuth } from '@/lib/auth-client'

type Connector = {
  id: string
  displayName: string
  type: 'SHOPIFY' | 'STRIPE' | 'GA4' | 'S3'
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
}

type SyncJob = {
  id: string
  connectorId: string
  trigger: 'MANUAL' | 'SCHEDULED' | 'RETRY'
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER'
  attempts: number
  maxAttempts: number
  errorMessage: string | null
  deadLetterReason: string | null
  createdAt: string
}

type ConnectorHealth = {
  totalConnectors: number
  connected: number
  errored: number
  disconnected: number
  completedLastHour: number
  failedLastHour: number
  successRateLastHour: number | null
}

type AuthSession = {
  id: string
  ip: string | null
  userAgent: string | null
  expiresAt: string
  isCurrent: boolean
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { orders, isUploaded } = useDataset()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [health, setHealth] = useState<ConnectorHealth | null>(null)
  const [sessions, setSessions] = useState<AuthSession[]>([])
  const [revokingSessions, setRevokingSessions] = useState(false)

  async function loadConnectorMonitoring() {
    setLoading(true)
    try {
      const [connectorRes, jobsRes] = await Promise.all([
        fetchWithAuth('/api/connectors', { cache: 'no-store' }),
        fetchWithAuth('/api/connectors/sync-jobs', { cache: 'no-store' }),
      ])
      const healthRes = await fetchWithAuth('/api/connectors/health', { cache: 'no-store' })
      const sessionsRes = await fetchWithAuth('/api/auth/sessions', { cache: 'no-store' })
      if (connectorRes.ok) {
        const connectorData = (await connectorRes.json()) as { connectors?: Connector[] }
        setConnectors(connectorData.connectors ?? [])
      }
      if (jobsRes.ok) {
        const jobsData = (await jobsRes.json()) as { jobs?: SyncJob[] }
        setJobs(jobsData.jobs ?? [])
      }
      if (healthRes.ok) {
        const healthData = (await healthRes.json()) as ConnectorHealth
        setHealth(healthData)
      }
      if (sessionsRes.ok) {
        const sessionsData = (await sessionsRes.json()) as { sessions?: AuthSession[] }
        setSessions(sessionsData.sessions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConnectorMonitoring()
  }, [])

  const connectorNameById = useMemo(() => {
    return new Map(connectors.map((connector) => [connector.id, connector.displayName]))
  }, [connectors])

  async function retryJob(jobId: string) {
    setRetryingJobId(jobId)
    try {
      await fetchWithAuth(`/api/connectors/sync-jobs/${jobId}/retry`, { method: 'POST', headers: withCsrfHeader() })
      await loadConnectorMonitoring()
    } finally {
      setRetryingJobId(null)
    }
  }

  async function runScheduledSync() {
    setSyncingAll(true)
    try {
      await fetchWithAuth('/api/connectors/sync-schedule', { method: 'POST', headers: withCsrfHeader() })
      await loadConnectorMonitoring()
    } finally {
      setSyncingAll(false)
    }
  }

  async function revokeAllOtherSessions() {
    setRevokingSessions(true)
    try {
      await fetchWithAuth('/api/auth/sessions', { method: 'POST', headers: withCsrfHeader() })
      await loadConnectorMonitoring()
    } finally {
      setRevokingSessions(false)
    }
  }

  async function revokeOneSession(sessionId: string) {
    setRevokingSessions(true)
    try {
      await fetchWithAuth(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: withCsrfHeader(),
      })
      await loadConnectorMonitoring()
    } finally {
      setRevokingSessions(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="sc">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-tx-primary">Appearance</h2>
        <RadioGroup.Root
          value={theme}
          onValueChange={(value) => setTheme(value)}
          className="flex gap-3"
        >
          {['light', 'dark', 'system'].map((mode) => (
            <label key={mode} className="ui-focus inline-flex items-center gap-2 rounded-lg border border-[#2a3246] bg-[#0f131b] px-3 py-2 text-sm text-[#d1d5db]">
              <RadioGroup.Item value={mode} className="h-4 w-4 rounded-full border border-[#6366f1] data-[state=checked]:bg-[#6366f1]" />
              {mode[0].toUpperCase() + mode.slice(1)}
            </label>
          ))}
        </RadioGroup.Root>
      </section>

      <section className="sc">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-tx-primary">Data</h2>
        <p className="text-sm text-tx-secondary">Total records loaded: {orders.length.toLocaleString()}</p>
        <p className="text-sm text-tx-secondary">Data source: {isUploaded ? 'Uploaded dataset' : 'Demo dataset'}</p>
      </section>

      <section className="sc">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-tx-primary">Security Sessions</h2>
          <button
            type="button"
            onClick={() => void revokeAllOtherSessions()}
            disabled={revokingSessions}
            className="rounded-md border border-[#2a3246] px-3 py-1.5 text-xs text-tx-secondary hover:bg-white/5 disabled:opacity-50"
          >
            Revoke other sessions
          </button>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-[#2a3246] bg-[#0f131b] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-tx-primary">
                  {session.isCurrent ? 'Current session' : 'Active session'} · {session.ip ?? 'Unknown IP'}
                </p>
                {!session.isCurrent ? (
                  <button
                    type="button"
                    disabled={revokingSessions}
                    onClick={() => void revokeOneSession(session.id)}
                    className="rounded-md border border-[#2a3246] px-2.5 py-1 text-xs text-tx-secondary disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-tx-secondary">
                Expires: {new Date(session.expiresAt).toLocaleString()}
              </p>
              {session.userAgent ? (
                <p className="text-xs text-tx-secondary">
                  {session.userAgent.length > 96 ? `${session.userAgent.slice(0, 96)}...` : session.userAgent}
                </p>
              ) : null}
            </div>
          ))}
          {!sessions.length ? (
            <p className="text-sm text-tx-secondary">No active sessions found.</p>
          ) : null}
        </div>
      </section>

      <section className="sc">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-tx-primary">Connector Sync Monitor</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void runScheduledSync()}
              disabled={syncingAll}
              className="rounded-md border border-[#2a3246] px-3 py-1.5 text-xs text-tx-secondary hover:bg-white/5 disabled:opacity-50"
            >
              {syncingAll ? 'Scheduling...' : 'Run all syncs'}
            </button>
            <button
              type="button"
              onClick={() => void loadConnectorMonitoring()}
              className="rounded-md border border-[#2a3246] px-3 py-1.5 text-xs text-tx-secondary hover:bg-white/5"
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="mb-3 text-sm text-tx-secondary">
          Connectors: {connectors.length} | Dead-letter jobs: {jobs.filter((j) => j.status === 'DEAD_LETTER').length}
        </p>
        {health ? (
          <p className="mb-3 text-xs text-tx-secondary">
            Health — Connected: {health.connected}/{health.totalConnectors} · Errors: {health.errored} · Last hour success: {health.successRateLastHour ?? 'N/A'}%
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-tx-secondary">Loading connector monitor...</p>
        ) : null}
        <div className="space-y-2">
          {jobs.slice(0, 12).map((job) => {
            const isRetryable = job.status === 'FAILED' || job.status === 'DEAD_LETTER'
            const name = connectorNameById.get(job.connectorId) ?? job.connectorId
            return (
              <div key={job.id} className="rounded-lg border border-[#2a3246] bg-[#0f131b] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-tx-primary">
                    {name} · {job.trigger} · <span className="font-semibold">{job.status}</span>
                  </p>
                  <button
                    type="button"
                    disabled={!isRetryable || retryingJobId === job.id}
                    onClick={() => void retryJob(job.id)}
                    className="rounded-md border border-[#2a3246] px-2.5 py-1 text-xs text-tx-secondary disabled:opacity-50"
                  >
                    {retryingJobId === job.id ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
                <p className="text-xs text-tx-secondary">
                  Attempts: {job.attempts}/{job.maxAttempts} · {new Date(job.createdAt).toLocaleString()}
                </p>
                {job.errorMessage ? <p className="mt-1 text-xs text-red-300">Error: {job.errorMessage}</p> : null}
                {job.deadLetterReason ? <p className="text-xs text-orange-300">Dead letter: {job.deadLetterReason}</p> : null}
              </div>
            )
          })}
          {!jobs.length && !loading ? (
            <p className="text-sm text-tx-secondary">No connector sync jobs yet.</p>
          ) : null}
        </div>
      </section>

      <section className="sc">
        <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-tx-primary">About</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-tx-secondary">
          <li>Next.js 14 + App Router</li>
          <li>TypeScript + Zustand + Recharts</li>
          <li>TanStack Table + React Virtuoso</li>
          <li>Web Worker powered data generation</li>
        </ul>
      </section>
    </div>
  )
}






