import { NextRequest, NextResponse } from 'next/server'
import type { Cell, Row } from 'exceljs'
import { parse as parseCsvStream } from 'csv-parse'
import crypto from 'crypto'
import Busboy from 'busboy'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { canAccess, readAuthContext } from '@/lib/server/auth'
import { enforceCsrf } from '@/lib/server/security'
import { createRequestLogContext } from '@/lib/server/logger'
import { captureBackendError } from '@/lib/server/sentry'
import { writeJsonArtifact } from '@/lib/server/artifact-store'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const UPLOAD_WINDOW_MS = 60_000
const UPLOAD_LIMIT_PER_WINDOW = 10
const uploadRateStore = new Map<string, number[]>()
const AV_SCANNER_ENABLED = process.env.ENABLE_AV_SCAN === 'true'
const BLOCKED_MIME_PREFIXES = ['application/x-msdownload', 'application/x-dosexec']

function readClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function allowUpload(clientKey: string): boolean {
  const now = Date.now()
  const windowStart = now - UPLOAD_WINDOW_MS
  const attempts = uploadRateStore.get(clientKey) ?? []
  const fresh = attempts.filter((ts) => ts > windowStart)
  if (fresh.length >= UPLOAD_LIMIT_PER_WINDOW) {
    uploadRateStore.set(clientKey, fresh)
    return false
  }
  fresh.push(now)
  uploadRateStore.set(clientKey, fresh)
  return true
}

async function runAntivirusScan(fileName: string, buffer: Buffer): Promise<{ ok: boolean; reason?: string }> {
  if (!AV_SCANNER_ENABLED) return { ok: true }
  const scannerUrl = process.env.AV_SCAN_URL?.trim()
  if (!scannerUrl) return { ok: false, reason: 'Antivirus scanning is enabled but AV_SCAN_URL is not configured' }

  const init: RequestInit & { duplex?: 'half' } = {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(fileName),
    },
    body: new Uint8Array(buffer),
  }

  const res = await fetch(scannerUrl, {
    ...init,
  })
  if (!res.ok) {
    return { ok: false, reason: `Antivirus service returned ${res.status}` }
  }
  const payload = (await res.json()) as { clean?: boolean; reason?: string }
  return payload.clean ? { ok: true } : { ok: false, reason: payload.reason ?? 'File flagged by antivirus scanner' }
}

async function parseMultipart(req: NextRequest): Promise<{ fileName: string; mimeType: string; filePath: string; bytes: number; fingerprint: string }> {
  const contentType = req.headers.get('content-type') ?? ''
  const busboy = Busboy({
    headers: { 'content-type': contentType },
    limits: {
      files: 1,
      parts: 10,
      fileSize: MAX_UPLOAD_BYTES,
    },
  })
  const tempPath = path.join(os.tmpdir(), `ecodash-upload-${crypto.randomUUID()}`)
  const writeStream = fs.createWriteStream(tempPath)
  const hash = crypto.createHash('sha256')
  let fileName = 'upload'
  let mimeType = ''
  let seenFile = false
  let totalBytes = 0

  const webStream = req.body
  if (!webStream) {
    throw new Error('Missing request body')
  }
  const nodeStream = (await import('stream')).Readable.fromWeb(webStream as any)

  await new Promise<void>((resolve, reject) => {
    let writeFinished = false
    writeStream.on('finish', () => {
      writeFinished = true
    })

    let fileTooLarge = false
    busboy.on('file', (_field, file, info) => {
      seenFile = true
      fileName = info.filename
      mimeType = info.mimeType
      file.on('limit', () => {
        fileTooLarge = true
      })
      file.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
        hash.update(chunk)
      })
      file.pipe(writeStream)
      file.on('error', reject)
    })
    busboy.on('error', reject)
    busboy.on('finish', async () => {
      if (!seenFile) {
        reject(new Error('No file provided'))
        return
      }
      if (fileTooLarge) {
        reject(new Error('File too large. Maximum size is 500MB.'))
        return
      }
      if (!writeFinished) {
        await new Promise<void>((done) => writeStream.once('finish', () => done()))
      }
      resolve()
    })
    nodeStream.pipe(busboy)
  })

  return {
    fileName,
    mimeType,
    filePath: tempPath,
    bytes: totalBytes,
    fingerprint: hash.digest('hex'),
  }
}

function decodeTextBuffer(buffer: Buffer): { text: string; encoding: 'utf-8' | 'windows-1252' | 'latin1' } {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    return { text: utf8Decoder.decode(buffer), encoding: 'utf-8' }
  } catch {
    // fallback
  }

  try {
    const win1252 = new TextDecoder('windows-1252', { fatal: false })
    return { text: win1252.decode(buffer), encoding: 'windows-1252' }
  } catch {
    // fallback
  }

  return { text: buffer.toString('latin1'), encoding: 'latin1' }
}

async function parseDelimitedText(text: string, separator: ',' | '\t'): Promise<Record<string, unknown>[]> {
  const parser = parseCsvStream({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: separator,
    bom: true,
    relax_quotes: true,
  })
  const rows: Record<string, unknown>[] = []
  const stream = Readable.from([text])

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(parser)
      .on('data', (record: Record<string, unknown>) => rows.push(record))
      .on('error', reject)
      .on('end', () => resolve())
  })

  return rows
}

async function sniffFileKind(filePath: string): Promise<'json' | 'csv' | 'tsv' | 'xlsx' | 'xls' | 'unknown'> {
  const handle = await fsp.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const sample = buffer.subarray(0, bytesRead)
    if (sample.length >= 4 && sample[0] === 0x50 && sample[1] === 0x4b && sample[2] === 0x03 && sample[3] === 0x04) {
      return 'xlsx'
    }
    if (
      sample.length >= 8 &&
      sample[0] === 0xd0 &&
      sample[1] === 0xcf &&
      sample[2] === 0x11 &&
      sample[3] === 0xe0 &&
      sample[4] === 0xa1 &&
      sample[5] === 0xb1 &&
      sample[6] === 0x1a &&
      sample[7] === 0xe1
    ) {
      return 'xls'
    }
    const text = sample.toString('utf8').trimStart()
    if (text.startsWith('{') || text.startsWith('[')) return 'json'
    if (text.includes('\n') && text.includes('\t')) return 'tsv'
    if (text.includes('\n') && text.includes(',')) return 'csv'
    return 'unknown'
  } finally {
    await handle.close()
  }
}

function isSniffCompatible(fileName: string, kind: 'json' | 'csv' | 'tsv' | 'xlsx' | 'xls' | 'unknown'): boolean {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return kind === 'json'
  if (lower.endsWith('.csv')) return kind === 'csv' || kind === 'tsv'
  if (lower.endsWith('.tsv')) return kind === 'tsv' || kind === 'csv'
  if (lower.endsWith('.xlsx')) return kind === 'xlsx'
  if (lower.endsWith('.xls')) return kind === 'xls'
  return false
}

export async function POST(req: NextRequest) {
  const requestLog = createRequestLogContext({ req })
  let tempFilePath: string | null = null
  try {
    const csrfError = enforceCsrf(req)
    if (csrfError) {
      requestLog.finish(403)
      return csrfError
    }

    const auth = readAuthContext(req)
    if (!auth || !canAccess(auth.role, 'dataset:write')) {
      requestLog.finish(401)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsedMultipart = await parseMultipart(req)
    const fileName = parsedMultipart.fileName
    tempFilePath = parsedMultipart.filePath
    if (!fileName) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const clientKey = readClientKey(req)
    if (!allowUpload(clientKey)) {
      requestLog.finish(429, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }

    const filename = fileName.toLowerCase()
    const mimeType = parsedMultipart.mimeType
    const allowedTypes = ['.csv', '.xlsx', '.tsv', '.json']
    const isAllowed = allowedTypes.some((ext) => filename.endsWith(ext))
    if (!isAllowed) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV, XLSX, TSV, or JSON.' }, { status: 400 })
    }

    const allowedMimes = new Set([
      'text/csv',
      'text/tab-separated-values',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '',
    ])
    if (BLOCKED_MIME_PREFIXES.some((blocked) => mimeType.startsWith(blocked))) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'Blocked file type.' }, { status: 400 })
    }
    if (!allowedMimes.has(mimeType)) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'Invalid file MIME type.' }, { status: 400 })
    }

    if (parsedMultipart.bytes > MAX_UPLOAD_BYTES) {
      requestLog.finish(413, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'File too large. Maximum size is 500MB.' }, { status: 413 })
    }

    const sniffKind = await sniffFileKind(parsedMultipart.filePath)
    if (!isSniffCompatible(fileName, sniffKind)) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'File content does not match extension.' }, { status: 400 })
    }
    if (filename.endsWith('.xls') || sniffKind === 'xls') {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json(
        { error: 'Legacy .xls files are not supported. Please convert and upload as .xlsx, CSV, TSV, or JSON.' },
        { status: 400 }
      )
    }

    const buffer = await fsp.readFile(parsedMultipart.filePath)
    const scan = await runAntivirusScan(fileName, buffer)
    if (!scan.ok) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: scan.reason ?? 'File rejected by antivirus scanner.' }, { status: 400 })
    }
    let rows: Record<string, unknown>[] = []
    let columns: string[] = []
    const decodedText = decodeTextBuffer(buffer)

    if (filename.endsWith('.csv') || filename.endsWith('.tsv')) {
      const separator = filename.endsWith('.tsv') ? '\t' : ','
      const records = await parseDelimitedText(decodedText.text, separator as ',' | '\t')
      if (records.length < 1) {
        requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
        return NextResponse.json({ error: 'File appears empty or has only headers.' }, { status: 400 })
      }
      columns = Object.keys(records[0] ?? {})
      rows = records.filter((row) => Object.values(row).some((v) => v !== ''))
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const loadInput = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
      await workbook.xlsx.load(loadInput)
      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
        return NextResponse.json({ error: 'Excel file has no worksheets.' }, { status: 400 })
      }

      const headerRow = worksheet.getRow(1)
      columns = []
      headerRow.eachCell((cell: Cell) => {
        columns.push(String(cell.value ?? '').trim())
      })

      rows = []
      worksheet.eachRow((row: Row, rowNumber: number) => {
        if (rowNumber === 1) return // skip header
        const rowObj: Record<string, unknown> = {}
        row.eachCell({ includeEmpty: true }, (cell: Cell, colNumber: number) => {
          const colName = columns[colNumber - 1]
          if (!colName) return
          // Normalize cell value
          let val: unknown = cell.value
          if (val && typeof val === 'object' && 'result' in val) {
            val = (val as { result: unknown }).result // formula result
          }
          if (val instanceof Date) {
            val = val.toISOString().slice(0, 10)
          }
          rowObj[colName] = val ?? ''
        })
        if (Object.values(rowObj).some((v) => v !== '' && v !== null && v !== undefined)) {
          rows.push(rowObj)
        }
      })
    } else if (filename.endsWith('.json')) {
      const parsed = JSON.parse(decodedText.text) as unknown
      rows = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[]
      columns = rows.length > 0 ? Object.keys(rows[0]) : []
    }

    if (rows.length === 0) {
      requestLog.finish(400, { workspace_id: auth.workspaceId, user_id: auth.userId })
      return NextResponse.json({ error: 'No data rows found in file.' }, { status: 400 })
    }

    const sample = rows.slice(0, 50)
    const parseFingerprint = parsedMultipart.fingerprint
    const safeFileName = fileName.replace(/[^\w.-]+/g, '_')
    const rawArtifactKey = `workspace/${auth.workspaceId}/raw/${parseFingerprint}-${safeFileName}.json`
    const processedArtifactKey = `workspace/${auth.workspaceId}/processed/${parseFingerprint}.json`
    const processedMetrics = {
      rowCount: rows.length,
      columnCount: columns.length,
      parser: filename.endsWith('.csv') || filename.endsWith('.tsv') ? 'csv' : filename.endsWith('.json') ? 'json' : 'excel',
      sourceEncoding: decodedText.encoding,
    }
    await writeJsonArtifact(rawArtifactKey, { rows, columns, fileName, sourceEncoding: decodedText.encoding })

    requestLog.finish(200, {
      workspace_id: auth.workspaceId,
      user_id: auth.userId,
      row_count: rows.length,
    })
    return NextResponse.json({
      columns,
      rowCount: rows.length,
      sample,
      fileName,
      parseFingerprint,
      rawArtifactKey,
      processedArtifactKey,
      processedMetrics,
    })
  } catch (err) {
    captureBackendError({
      error: err,
      requestId: requestLog.requestId,
      context: { route: '/api/parse-file' },
    })
    requestLog.finish(500)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    if (tempFilePath) {
      await fsp.unlink(tempFilePath).catch(() => {})
    }
  }
}
