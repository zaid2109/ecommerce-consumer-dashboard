import { useDatasetStore } from '@/lib/dataset-store'
import { orders as syntheticOrders, aggregated as syntheticAggregated } from '@/lib/data-generator'
import type { DatasetMeta } from '@/lib/dataset-store'
import type { PreAggregated } from '@/lib/types'

export function useDataset(): {
  aggregated: PreAggregated
  isUploaded: boolean
  meta: DatasetMeta | null
  orders: typeof syntheticOrders
} {
  const { activeDataset, activeOrders, meta } = useDatasetStore()
  const isUploaded = activeDataset !== null

  return {
    aggregated: activeDataset ?? syntheticAggregated,
    isUploaded,
    meta,
    orders: isUploaded ? ((activeOrders ?? []) as typeof syntheticOrders) : syntheticOrders,
  }
}
