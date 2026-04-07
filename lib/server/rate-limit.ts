import { getRedisClient } from './redis'

const buckets = new Map<string, number[]>()

function prune(entries: number[], windowMs: number, now: number): number[] {
  const start = now - windowMs
  return entries.filter((ts) => ts > start)
}

type RateLimitInput = {
  key: string
  action: string
  limit: number
  windowMs: number
}

function allowActionInMemory(input: RateLimitInput): boolean {
  const now = Date.now()
  const bucketKey = `${input.action}:${input.key}`
  const existing = buckets.get(bucketKey) ?? []
  const fresh = prune(existing, input.windowMs, now)
  if (fresh.length >= input.limit) {
    buckets.set(bucketKey, fresh)
    return false
  }
  fresh.push(now)
  buckets.set(bucketKey, fresh)
  return true
}

export async function allowAction(input: RateLimitInput): Promise<boolean> {
  const bucketKey = `${input.action}:${input.key}`
  const redis = getRedisClient()
  if (!redis) {
    return allowActionInMemory(input)
  }

  try {
    const value = await redis.incr(bucketKey)
    if (value === 1) {
      await redis.pexpire(bucketKey, input.windowMs)
    }
    return value <= input.limit
  } catch {
    return allowActionInMemory(input)
  }
}
