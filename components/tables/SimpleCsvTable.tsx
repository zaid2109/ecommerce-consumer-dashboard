'use client'

type SimpleCsvTableProps = {
  title: string
  columns: string[]
  rows: Array<Array<string | number>>
  filename: string
}

export function SimpleCsvTable({ title, columns, rows, filename }: SimpleCsvTableProps) {
  const exportCsv = () => {
    const csv = [columns, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="sc">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="sc-title">{title}</h3>
        <button onClick={exportCsv} className="rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-medium text-white">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="st w-full min-w-[900px]" role="table" aria-label={title}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th scope="col" key={c} className="py-2 text-left text-xs uppercase tracking-wide text-gray-500">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-[#f1f5f9] last:border-0 dark:border-[#2d3748]/60">
                {row.map((cell, cIdx) => (
                  <td key={`${rIdx}-${cIdx}`} className="py-2 text-sm text-gray-700 dark:text-gray-200">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default SimpleCsvTable
