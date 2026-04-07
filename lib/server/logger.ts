import crypto from 'crypto'
import type { NextRequest } from 'next/server'

type BaseLog = Record<string, unknown> & {
  level: 'info' | 'error'
  message: string
  timestamp: string
}

function emit(log: BaseLog) {
  // JSON logs for ingestion by log aggregators.
  console.log(JSON.stringify(log))
}

export function logInfo(message: string, fields: Record<string, unknown> = {}) {
  emit({ level: 'info', message, timestamp: new Date().toISOString(), ...fields })
}

export function logError(message: string, fields: Record<string, unknown> = {}) {
  emit({ level: 'error', message, timestamp: new Date().toISOString(), ...fields })
}

export function createRequestLogContext(input: {
  req: NextRequest
  workspaceId?: string
  userId?: string
}) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  const method = input.req.method
  const path = input.req.nextUrl.pathname
  return {
    requestId,
    finish(statusCode: number, extra: Record<string, unknown> = {}) {
      const durationMs = Date.now() - startedAt
      logInfo('http.request', {
        request_id: requestId,
        workspace_id: input.workspaceId ?? null,
        user_id: input.userId ?? null,
        method,
        path,
        status_code: statusCode,
        duration_ms: durationMs,
        ...extra,
      })
    },
  }
}

export function logJobEvent(input: {
  jobId: string
  datasetId?: string
  workspaceId?: string
  connectorId?: string
  stage: string
  status: string
  rowsProcessed?: number
  error?: string
}) {
  logInfo('job.event', {
    job_id: input.jobId,
    dataset_id: input.datasetId ?? null,
    workspace_id: input.workspaceId ?? null,
    connector_id: input.connectorId ?? null,
    stage: input.stage,
    status: input.status,
    rows_processed: input.rowsProcessed ?? null,
    error: input.error ?? null,
  })
}

