'use client'

import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import InsightBanner from '@/components/cards/InsightBanner'
import RecommendedActions from '@/components/cards/RecommendedActions'
import ChartInfoTooltip from '@/components/ui/ChartInfoTooltip'
import { usePaymentsData } from '@/hooks/useCommerceData'
import { formatNumber } from '@/lib/utils'
import PaymentOrdersTable from '@/components/tables/PaymentOrdersTable'
import { useDataset } from '@/hooks/useDataset'
import { useFilterStore } from '@/lib/store'
import { generateActions } from '@/lib/recommendations'
import { generatePaymentInsights } from '@/lib/insights'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const PaymentShareDonut = dynamic(() => import('@/components/charts/PaymentShareDonut'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const PaymentTrendLine = dynamic(() => import('@/components/charts/PaymentTrendLine'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const FailureRateBar = dynamic(() => import('@/components/charts/FailureRateBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const AvgTransactionBar = dynamic(() => import('@/components/charts/AvgTransactionBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const SegmentMethodHeatmap = dynamic(() => import('@/components/charts/SegmentMethodHeatmap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })

export default function PaymentsPage() {
  const data = usePaymentsData()
  
  const { aggregated } = useDataset()
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const insights = generatePaymentInsights(aggregated, filterState)
  const actions = generateActions(aggregated, filterState)
  const spark = data.avgTxData.map((d) => d.value)

  return (
    <div className="space-y-6">
      <FilterBar />
      <InsightBanner insights={insights} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <KPICard title="Success Rate" value={data.kpi.successRate.toFixed(1)} suffix="%" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg Transaction Value" value={data.kpi.avgTransactionValue.toFixed(2)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Failed Payments" value={formatNumber(data.kpi.failedPayments)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Most Used Method" value={data.kpi.topMethod} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Payment share</h3>
            <ChartInfoTooltip text="Shows distribution of payment method usage to identify dependence and diversification needs." />
          </div>
          <PaymentShareDonut data={data.donutData} />
        </article>
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Payment trend</h3>
            <ChartInfoTooltip text="Compares monthly payment method trajectory to detect channel preference shifts." />
          </div>
          <PaymentTrendLine data={data.trendData} methods={data.segmentMethodHeatmap.methods} />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Failure rate by method</h3>
            <ChartInfoTooltip text="Highlights methods with excessive failures against portfolio benchmark to prioritize fixes." />
          </div>
          <FailureRateBar data={data.failureData} benchmark={data.avgFailureBenchmark} />
        </article>
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Avg transaction by method</h3>
            <ChartInfoTooltip text="Compares transaction value quality by payment method to optimize checkout default ordering." />
          </div>
          <AvgTransactionBar data={data.avgTxData} />
        </article>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Segment × Method heatmap</h3>
          <ChartInfoTooltip text="Reveals segment-specific method preferences for targeted payment UX optimization." />
        </div>
        <SegmentMethodHeatmap methods={data.segmentMethodHeatmap.methods} rows={data.segmentMethodHeatmap.rows} />
      </section>

      <PaymentOrdersTable rows={data.paymentTableRows} />

      <RecommendedActions actions={actions} />
    </div>
  )
}








