import { Queue } from 'bullmq'
import { getRedisClient } from './redis'

let queueInstance: Queue | null = null

export function getIngestionQueue(): Queue | null {
  if (queueInstance) return queueInstance

  const connection = getRedisClient()
  if (!connection) return null

  queueInstance = new Queue('ingestion-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  })

  return queueInstance
}
