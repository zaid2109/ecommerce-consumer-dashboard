export async function downloadChartAsPNG(elementId: string, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const el = document.getElementById(elementId)
  if (!el) return
  const canvas = await html2canvas(el, { backgroundColor: null })
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export default downloadChartAsPNG
