'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { interpolateColor } from '@/lib/utils'
import SpireTooltip from './ChartTooltip'

type Node = { name: string; size: number; returnRate: number }

type CategoryTreemapProps = {
  data: Node[]
  onSelectCategory?: (category: string) => void
}

export const CategoryTreemap = memo(function CategoryTreemap({ data, onSelectCategory }: CategoryTreemapProps) {
  const hasAnimated = useRef(false)
  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const colored = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        fill: interpolateColor(d.returnRate, 0, 0.25, '#10b981', '#ef4444'),
      })),
    [data]
  )

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap
        data={colored}
        dataKey="size"
        stroke="#fff"
        isAnimationActive={!hasAnimated.current}
        onClick={(p) => {
          const node = p as { name?: string }
          if (node?.name && onSelectCategory) onSelectCategory(node.name)
        }}
      >
        <Tooltip content={(props) => <SpireTooltip {...props} formatter={(value: number) => value.toFixed(0)} />} />
      </Treemap>
    </ResponsiveContainer>
  )
})

CategoryTreemap.displayName = 'CategoryTreemap'

export default CategoryTreemap


