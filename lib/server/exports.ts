import { readJsonArtifact, writeJsonArtifact } from '@/lib/server/artifact-store'
import { prisma } from '@/lib/server/prisma'

type ExportFormat = 'CSV' | 'XLSX' | 'PDF'

type DatasetArtifact = {
  orders?: Array<Record<string, unknown>>
}

function escapeCsv(input: unknown): string {
  const raw = String(input ?? '')
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const header = columns.join(',')
  const body = rows.map((row) => columns.map((c) => escapeCsv(row[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export async function runExportJob(exportJobId: string, workspaceId: string, datasetId: string | null, format: ExportFormat) {
  const job = await prisma.exportJob.findFirst({
    where: { id: exportJobId, workspaceId },
    select: { id: true },
  })
  if (!job) return

  await prisma.exportJob.update({
    where: { id: exportJobId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  })

  try {
    if (!datasetId) throw new Error('datasetId is required')
    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, workspaceId },
      select: { s3ProcessedKey: true, name: true },
    })
    if (!dataset?.s3ProcessedKey) throw new Error('Dataset processed artifact missing')

    const artifact = await readJsonArtifact<DatasetArtifact>(dataset.s3ProcessedKey)
    const rows = artifact?.orders ?? []
    const csv = toCsv(rows)

    const suffix = format.toLowerCase()
    const artifactKey = `exports/${workspaceId}/${exportJobId}.${suffix === 'xlsx' ? 'csv' : suffix === 'pdf' ? 'txt' : 'csv'}`
    await writeJsonArtifact(artifactKey, {
      format,
      generatedAt: new Date().toISOString(),
      datasetId,
      datasetName: dataset.name,
      content: csv,
      note:
        format === 'CSV'
          ? null
          : `Requested ${format} export is stored as text payload for async job traceability. Hook a renderer service for native ${format}.`,
    })

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETED',
        artifactKey,
        completedAt: new Date(),
        auditMetadata: {
          completedByWorker: true,
          exportedRows: rows.length,
          format,
        },
      },
    })
  } catch (error) {
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    })
  }
}
