'use client'

import { useEffect, useState } from 'react'
import { dataReady } from '@/lib/data-store'

export function DataLoadingScreen() {
  const [visible, setVisible] = useState(true)
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const worker = new Worker('/workers/dataWorker.js')
    worker.addEventListener('message', (event: MessageEvent) => {
      const payload = event.data as { type: string; percent?: number }
      if (payload.type === 'progress' && typeof payload.percent === 'number') {
        setPercent(payload.percent)
      }
    })
    worker.postMessage({ type: 'start' })

    dataReady.finally(() => {
      setPercent(100)
      setVisible(false)
      worker.terminate()
    })

    return () => worker.terminate()
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-xl px-6">
        <p className="mb-4 text-center text-sm font-medium text-white">
          Generating 100,000 orders... {percent}%
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-[#6366f1] transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  )
}

export default DataLoadingScreen

