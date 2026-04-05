'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import { formatCurrency } from '@/lib/utils'

type CountryTreemapProps = {
  data: { name: string; size: number }[]
}

export const CountryTreemap = memo(function CountryTreemap({ data }: CountryTreemapProps) {
  const hasAnimated = useRef(false)

  useEffect(() => {
    hasAnimated.current = true
  }, [])

  const max = useMemo(() => Math.max(...data.map((d) => d.size), 1), [data])
  const colored = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        fill: `rgba(99,102,241,${Math.max(0.25, d.size / max)})`,
      })),
    [data, max]
  )

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap data={colored} dataKey="size" stroke="#fff" isAnimationActive={!hasAnimated.current}>
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
      </Treemap>
    </ResponsiveContainer>
  )
})

CountryTreemap.displayName = 'CountryTreemap'

export default CountryTreemap


