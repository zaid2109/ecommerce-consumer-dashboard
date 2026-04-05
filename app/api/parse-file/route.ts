import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const filename = file.name.toLowerCase()
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.tsv', '.json']
    const isAllowed = allowedTypes.some((ext) => filename.endsWith(ext))
    if (!isAllowed) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV, Excel, TSV, or JSON.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let rows: Record<string, unknown>[] = []
    let columns: string[] = []

    if (filename.endsWith('.csv') || filename.endsWith('.tsv')) {
      const separator = filename.endsWith('.tsv') ? '\t' : ','
      const text = buffer.toString('utf-8')
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) {
        return NextResponse.json({ error: 'File appears empty or has only headers.' }, { status: 400 })
      }
      columns = lines[0].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''))
      rows = lines
        .slice(1)
        .map((line) => {
          const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ''))
          const row: Record<string, unknown> = {}
          columns.forEach((col, i) => {
            row[col] = values[i] ?? ''
          })
          return row
        })
        .filter((row) => Object.values(row).some((v) => v !== ''))
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
      columns = rows.length > 0 ? Object.keys(rows[0]) : []
    } else if (filename.endsWith('.json')) {
      const text = buffer.toString('utf-8')
      const parsed = JSON.parse(text) as unknown
      rows = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[]
      columns = rows.length > 0 ? Object.keys(rows[0]) : []
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in file.' }, { status: 400 })
    }

    const cappedRows = rows.slice(0, 100000)
    const sample = cappedRows.slice(0, 50)

    return NextResponse.json({
      rows: cappedRows,
      columns,
      rowCount: cappedRows.length,
      sample,
      fileName: file.name,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    console.error('parse-file error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
