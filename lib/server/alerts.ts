import { prisma } from '@/lib/server/prisma'
import { logError, logInfo } from '@/lib/server/logger'
import { readJsonArtifact } from '@/lib/server/artifact-store'

type DatasetArtifact = {
  orders?: Array<Record<string, unknown>>
  aggregated?: {
    dailyRevenue?: Array<{ date: string; gross: number; net: number }>
  }
}

function extractMetric(metric: string, artifact: DatasetArtifact): number {
  const daily = artifact.aggregated?.dailyRevenue ?? []
  if (metric === 'daily_revenue_latest') return daily.at(-1)?.net ?? 0
  if (metric === 'daily_revenue_7d_avg') {
    const slice = daily.slice(-7)
    if (!slice.length) return 0
    return slice.reduce((sum, row) => sum + row.net, 0) / slice.length
  }
  if (metric === 'orders_count') return Array.isArray(artifact.orders) ? artifact.orders.length : 0
  return 0
}

function isBreached(metricValue: number, comparator: string, threshold: number | null): boolean {
  if (threshold === null) return false
  if (comparator === '>') return metricValue > threshold
  if (comparator === '>=') return metricValue >= threshold
  if (comparator === '<') return metricValue < threshold
  if (comparator === '<=') return metricValue <= threshold
  if (comparator === '=') return metricValue === threshold
  return false
}

async function notifySlack(webhook: string, message: string) {
  await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })
}

async function notifyEmailWebhook(url: string, payload: { to: string[]; subject: string; body: string }) {
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function evaluateAlertRules(workspaceId: string, datasetId: string) {
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, workspaceId, status: 'READY' },
    select: { s3ProcessedKey: true },
  })
  if (!dataset?.s3ProcessedKey) return

  const artifact = await readJsonArtifact<DatasetArtifact>(dataset.s3ProcessedKey)
  if (!artifact) return

  const rules = await prisma.alertRule.findMany({
    where: { workspaceId, enabled: true },
    orderBy: { createdAt: 'asc' },
  })

  for (const rule of rules) {
    const metricValue = extractMetric(rule.metric, artifact)
    const breached = rule.type === 'ANOMALY'
      ? metricValue > 0 && Math.abs(metricValue) > (rule.threshold ?? 0)
      : isBreached(metricValue, rule.comparator, rule.threshold)
    if (!breached) continue

    const title = `Alert breached: ${rule.name}`
    const message = `Metric ${rule.metric} is ${metricValue} (rule ${rule.comparator} ${rule.threshold ?? 'n/a'})`

    const event = await prisma.alertEvent.create({
      data: {
        workspaceId,
        ruleId: rule.id,
        title,
        message,
        metricValue,
        metadata: { datasetId },
      },
    })

    const summary = `${title}\n${message}\nEvent: ${event.id}`
    try {
      if (rule.channels.includes('SLACK') && rule.slackWebhook) {
        await notifySlack(rule.slackWebhook, summary)
      }
      if (rule.channels.includes('EMAIL')) {
        const emailWebhook = process.env.ALERT_EMAIL_WEBHOOK?.trim()
        if (emailWebhook && rule.emailTargets.length > 0) {
          await notifyEmailWebhook(emailWebhook, {
            to: rule.emailTargets,
            subject: title,
            body: summary,
          })
        } else {
          logInfo('alert.email.skipped', { workspace_id: workspaceId, event_id: event.id })
        }
      }
    } catch (error) {
      logError('alert.notify.failed', {
        workspace_id: workspaceId,
        rule_id: rule.id,
        event_id: event.id,
        error_message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
