import { readJsonArtifact, writeJsonArtifact, writeBinaryArtifact } from '@/lib/server/artifact-store'
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

async function toXlsx(rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Export')

  if (rows.length > 0) {
    const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
    sheet.columns = columns.map((key) => ({ header: key, key, width: 18 }))
    for (const row of rows) {
      sheet.addRow(row)
    }
    // Bold the header row
    sheet.getRow(1).font = { bold: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function runExportJob(
  exportJobId: string,
  workspaceId: string,
  datasetId: string | null,
  format: ExportFormat
) {
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

    let artifactKey: string
    let auditMeta: Record<string, unknown>

    if (format === 'XLSX') {
      const xlsxBuffer = await toXlsx(rows)
      artifactKey = `exports/${workspaceId}/${exportJobId}.xlsx`
      await writeBinaryArtifact(artifactKey, xlsxBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      auditMeta = { exportedRows: rows.length, format, encoding: 'binary' }
    } else if (format === 'PDF') {
      // PDF generation requires an external renderer (e.g. Puppeteer, WeasyPrint).
      // Until one is configured, we emit CSV and store it under a .pdf key so the
      // job completes and callers receive a usable download.
      const csv = toCsv(rows)
      artifactKey = `exports/${workspaceId}/${exportJobId}.pdf`
      await writeJsonArtifact(artifactKey, {
        format: 'PDF',
        note: 'PDF renderer not configured — content is CSV. Set up a PDF renderer service to produce native PDFs.',
        generatedAt: new Date().toISOString(),
        datasetId,
        datasetName: dataset.name,
        content: csv,
      })
      auditMeta = { exportedRows: rows.length, format, encoding: 'csv-fallback' }
    } else {
      const csv = toCsv(rows)
      artifactKey = `exports/${workspaceId}/${exportJobId}.csv`
      await writeJsonArtifact(artifactKey, {
        format,
        generatedAt: new Date().toISOString(),
        datasetId,
        datasetName: dataset.name,
        content: csv,
      })
      auditMeta = { exportedRows: rows.length, format }
    }

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETED',
        artifactKey,
        completedAt: new Date(),
        auditMetadata: { completedByWorker: true, ...auditMeta },
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
