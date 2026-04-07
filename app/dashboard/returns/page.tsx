'use client'

import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import InsightBanner from '@/components/cards/InsightBanner'
import RecommendedActions from '@/components/cards/RecommendedActions'
import ChartInfoTooltip from '@/components/ui/ChartInfoTooltip'
import WidgetErrorBoundary from '@/components/ui/WidgetErrorBoundary'
import { useReturnsData } from '@/hooks/useCommerceData'
import { formatCurrency, formatNumber } from '@/lib/utils'
import SimpleCsvTable from '@/components/tables/SimpleCsvTable'
import { useDataset } from '@/hooks/useDataset'
import { useFilterStore } from '@/lib/store'
import { generateActions } from '@/lib/recommendations'
import { generateReturnInsights } from '@/lib/insights'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const ReturnRateCategoryBar = dynamic(() => import('@/components/charts/ReturnRateCategoryBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const ReturnReasonDonut = dynamic(() => import('@/components/charts/ReturnReasonDonut'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const ReturnTimelineLine = dynamic(() => import('@/components/charts/ReturnTimelineLine'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const ReturnBySegmentBar = dynamic(() => import('@/components/charts/ReturnBySegmentBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const ReturnRateOverTime = dynamic(() => import('@/components/charts/ReturnRateOverTime'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const RefundHeatmap = dynamic(() => import('@/components/charts/RefundHeatmap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })

export default function ReturnsPage() {
  const data = useReturnsData()
  
  const { aggregated } = useDataset()
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const insights = generateReturnInsights(aggregated, filterState)
  const actions = generateActions(aggregated, filterState)
  const spark = data.returnRateOverTime.map((r) => r.rate * 100)

  const rows = data.returnsTableRows.map((r) => [
    r.orderId,
    r.category,
    r.reason,
    r.daysToReturn,
    formatCurrency(r.refundAmount),
    r.segment,
    r.resolution,
  ])

  return (
    <div className="space-y-6">
      <FilterBar />
      <InsightBanner insights={insights} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <KPICard title="Total Returns" value={formatNumber(data.kpi.totalReturns)} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Refund Value" value={formatNumber(data.kpi.refundValue)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Return Rate" value={data.kpi.returnRate.toFixed(1)} suffix="%" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg Days to Return" value={data.kpi.avgDaysToReturn.toFixed(1)} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Return rate by category</h3>
            <ChartInfoTooltip text="Identifies which categories drive the most refund costs and quality risk." />
          </div>
          <WidgetErrorBoundary title="Return rate by category">
            <ReturnRateCategoryBar data={data.categoryRateData.map((r) => ({ category: r.category, rate: r.rate }))} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Return reasons</h3>
            <ChartInfoTooltip text="Breaks down top return reasons to guide merchandising and quality interventions." />
          </div>
          <WidgetErrorBoundary title="Return reasons">
            <ReturnReasonDonut data={data.reasonDonut} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Return timeline (days after purchase)</h3>
            <ChartInfoTooltip text="Shows when returns occur after purchase to optimize post-delivery follow-up timing." />
          </div>
          <WidgetErrorBoundary title="Return timeline">
            <ReturnTimelineLine data={data.returnTimeline} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Returns by segment</h3>
            <ChartInfoTooltip text="Compares return behavior by customer segment to target support and policy efforts." />
          </div>
          <WidgetErrorBoundary title="Returns by segment">
            <ReturnBySegmentBar data={data.returnBySegment} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Return rate over time</h3>
          <ChartInfoTooltip text="Tracks long-term return trend and campaign impact markers to evaluate policy changes." />
        </div>
        <WidgetErrorBoundary title="Return rate over time">
          <ReturnRateOverTime data={data.returnRateOverTime} />
        </WidgetErrorBoundary>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Refund heatmap</h3>
          <ChartInfoTooltip text="Displays category-month refund intensity to reveal persistent problem clusters." />
        </div>
        <WidgetErrorBoundary title="Refund heatmap">
          <RefundHeatmap data={data.refundHeatmap} />
        </WidgetErrorBoundary>
      </section>

      <WidgetErrorBoundary title="Returned orders table">
        <SimpleCsvTable
          title="Returned orders"
          filename="returns-orders.csv"
          columns={['Order ID', 'Category', 'Reason', 'Days to Return', 'Refund Amount', 'Segment', 'Resolution']}
          rows={rows}
        />
      </WidgetErrorBoundary>

      <RecommendedActions actions={actions} />
    </div>
  )
}








