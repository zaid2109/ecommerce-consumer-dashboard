import IORedis from 'ioredis'

let redisInstance: IORedis | null | undefined

function getRedisUrl(): string | null {
  const value = process.env.REDIS_URL
  if (!value || value.trim().length === 0) return null
  return value.trim()
}

export function getRedisClient(): IORedis | null {
  if (redisInstance !== undefined) return redisInstance

  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    redisInstance = null
    return redisInstance
  }

  redisInstance = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })

  return redisInstance
}
