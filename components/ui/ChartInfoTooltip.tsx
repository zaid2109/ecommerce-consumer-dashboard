'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { CircleHelp } from 'lucide-react'

type ChartInfoTooltipProps = {
  text: string
}

export function ChartInfoTooltip({ text }: ChartInfoTooltipProps) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="ui-focus inline-flex h-6 w-6 items-center justify-center rounded-full text-tx-muted hover:bg-[#1e2433] hover:text-tx-secondary"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            className="max-w-xs rounded-md border border-[#2a3246] bg-[#141820] px-3 py-2 text-xs text-[#e2e8f0] shadow-lg"
          >
            {text}
            <Tooltip.Arrow className="fill-[#141820]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export default ChartInfoTooltip

