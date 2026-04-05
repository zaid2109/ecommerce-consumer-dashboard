'use client'

type ChartSkeletonProps = {
  height?: number
}

export function KPICardSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-xl bg-gray-200 dark:bg-[#1a1d27]" />
  )
}

export function ChartSkeleton({ height = 300 }: ChartSkeletonProps) {
  return (
    <div
      className="animate-pulse rounded-xl bg-gray-200 dark:bg-[#1a1d27]"
      style={{ height }}
    />
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-[#1a1d27]" />
      ))}
    </div>
  )
}

export default {
  KPICardSkeleton,
  ChartSkeleton,
  TableSkeleton,
}

