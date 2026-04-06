import { NextRequest, NextResponse } from 'next/server'
import type { Cell, Row } from 'exceljs'

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
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const loadInput = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
      await workbook.xlsx.load(loadInput)
      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
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
