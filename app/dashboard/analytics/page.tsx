'use client'

import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import InsightBanner from '@/components/cards/InsightBanner'
import RecommendedActions from '@/components/cards/RecommendedActions'
import ChartInfoTooltip from '@/components/ui/ChartInfoTooltip'
import WidgetErrorBoundary from '@/components/ui/WidgetErrorBoundary'
import { useAnalyticsPageData } from '@/hooks/useDashboardData'
import { formatNumber } from '@/lib/utils'
import { useDataset } from '@/hooks/useDataset'
import { useFilterStore } from '@/lib/store'
import { generateActions } from '@/lib/recommendations'
import { generateAnalyticsInsights } from '@/lib/insights'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const FrequencyHistogram = dynamic(() => import('@/components/charts/FrequencyHistogram'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CohortHeatmap = dynamic(() => import('@/components/charts/CohortHeatmap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const DayOfWeekChart = dynamic(() => import('@/components/charts/DayOfWeekChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const TimeOfDayHeatmap = dynamic(() => import('@/components/charts/TimeOfDayHeatmap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const MovingAverageChart = dynamic(() => import('@/components/charts/MovingAverageChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const AnalyticsCustomerTable = dynamic(() => import('@/components/tables/AnalyticsCustomerTable'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })

export default function AnalyticsPage() {
  const data = useAnalyticsPageData()
  const { aggregated } = useDataset()
  const spark = data.movingAverageData.slice(-30).map((d) => d.raw)
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const insights = generateAnalyticsInsights(aggregated, filterState)
  const actions = generateActions(aggregated, filterState)

  return (
    <div className="space-y-6">
      <FilterBar />
      <InsightBanner insights={insights} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <KPICard title="Avg orders per customer" value={data.kpi.avgOrdersPerCustomer.toFixed(2)} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Repeat purchase rate" value={data.kpi.repeatPurchaseRate.toFixed(1)} suffix="%" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg days between orders" value={data.kpi.avgDaysBetween.toFixed(1)} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Estimated LTV" value={formatNumber(data.kpi.estimatedLTV)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="sc xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Frequency distribution</h3>
            <ChartInfoTooltip text="Shows how often customers purchase, highlighting repeat behavior concentration." />
          </div>
          <WidgetErrorBoundary title="Frequency distribution">
            <FrequencyHistogram data={data.frequencyData} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Cohort retention</h3>
            <ChartInfoTooltip text="Tracks repeat purchasing by cohort month to reveal retention decay and loyalty quality." />
          </div>
          <WidgetErrorBoundary title="Cohort retention">
            <CohortHeatmap data={data.cohortData} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Day of week pattern</h3>
            <ChartInfoTooltip text="Compares weekday demand cycles so marketing and inventory can align with peak order days." />
          </div>
          <WidgetErrorBoundary title="Day of week pattern">
            <DayOfWeekChart data={data.dayOfWeekData} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Time of day heatmap</h3>
            <ChartInfoTooltip text="Surfaces hour-level traffic hotspots to optimize staffing, campaigns, and fulfillment cutoffs." />
          </div>
          <WidgetErrorBoundary title="Time of day heatmap">
            <TimeOfDayHeatmap data={data.timeOfDayData} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Moving average trend</h3>
          <ChartInfoTooltip text="Smooths revenue volatility to expose true short and medium-term demand direction." />
        </div>
        <WidgetErrorBoundary title="Moving average trend">
          <MovingAverageChart data={data.movingAverageData} />
        </WidgetErrorBoundary>
      </section>

      <WidgetErrorBoundary title="Analytics customer table">
        <AnalyticsCustomerTable rows={data.tableRows} />
      </WidgetErrorBoundary>
      <RecommendedActions actions={actions} />
    </div>
  )
}







