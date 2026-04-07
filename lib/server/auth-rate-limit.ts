import { allowAction } from './rate-limit'

export async function allowAuthAttempt(input: {
  key: string
  action: 'auth-login' | 'auth-refresh'
  limit: number
  windowMs: number
}): Promise<boolean> {
  return allowAction({
    key: input.key,
    action: input.action,
    limit: input.limit,
    windowMs: input.windowMs,
  })
}

