import { logError } from './logger'

export function captureBackendError(input: {
  error: unknown
  requestId?: string
  workspaceId?: string
  userId?: string
  context?: Record<string, unknown>
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error)
  const stack = input.error instanceof Error ? input.error.stack : undefined
  // Sentry SDK wiring can be dropped in here without changing route callers.
  logError('backend.error', {
    request_id: input.requestId ?? null,
    workspace_id: input.workspaceId ?? null,
    user_id: input.userId ?? null,
    error_message: message,
    error_stack: stack ?? null,
    ...input.context,
  })
}

