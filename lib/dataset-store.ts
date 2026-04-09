import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Order, PreAggregated } from './types'

export interface ColumnMapping {
  orderId: string | null
  date: string | null
  revenue: string | null
  category: string | null
  customerName: string | null
  customerSegment: string | null
  country: string | null
  quantity: string | null
  unitPrice: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  isReturned: string | null
  returnReason: string | null
  rating: string | null
  discount: string | null
  productName: string | null
}

export interface DatasetMeta {
  fileName: string
  rowCount: number
  columns: string[]
  uploadedAt: string
  datasetType: string
  datasetId?: string
  jobId?: string
  status?: string
  aiInsights: string[]
  suggestedKPIs: { label: string; value: string; delta: string; positive: boolean }[]
}

interface DatasetState {
  activeDataset: PreAggregated | null
  activeOrders: Order[] | null
  meta: DatasetMeta | null
  columnMapping: ColumnMapping | null
  rawRows: Record<string, unknown>[] | null
  isUploading: boolean
  uploadStep: 'idle' | 'parsing' | 'analyzing' | 'queueing' | 'processing' | 'mapping' | 'transforming' | 'ready'
  uploadError: string | null

  setRawRows: (rows: Record<string, unknown>[]) => void
  setColumnMapping: (mapping: ColumnMapping) => void
  setMeta: (meta: DatasetMeta) => void
  setActiveDataset: (data: PreAggregated, orders: Order[]) => void
  setUploadStep: (step: DatasetState['uploadStep']) => void
  setUploadError: (err: string | null) => void
  setIsUploading: (v: boolean) => void
  clearDataset: () => void
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set) => ({
      activeDataset: null,
      activeOrders: null,
      meta: null,
      columnMapping: null,
      rawRows: null,
      isUploading: false,
      uploadStep: 'idle',
      uploadError: null,

      setRawRows: (rawRows) => set({ rawRows }),
      setColumnMapping: (columnMapping) => set({ columnMapping }),
      setMeta: (meta) => set({ meta }),
      setActiveDataset: (activeDataset, activeOrders) => set({ activeDataset, activeOrders, uploadStep: 'ready' }),
      setUploadStep: (uploadStep) => set({ uploadStep }),
      setUploadError: (uploadError) => set({ uploadError, isUploading: false }),
      setIsUploading: (isUploading) => set({ isUploading }),
      clearDataset: () =>
        set({
          activeDataset: null,
          activeOrders: null,
          meta: null,
          columnMapping: null,
          rawRows: null,
          uploadStep: 'idle',
          uploadError: null,
        }),
    }),
    {
      name: 'ecodash-dataset',
      partialize: (state) => ({
        meta: state.meta,
        columnMapping: state.columnMapping,
      }),
    }
  )
)
