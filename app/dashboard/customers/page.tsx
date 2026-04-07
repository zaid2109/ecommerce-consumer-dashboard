'use client'

import dynamic from 'next/dynamic'
import { Crown, Users, AlertCircle } from 'lucide-react'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import InsightBanner from '@/components/cards/InsightBanner'
import RecommendedActions from '@/components/cards/RecommendedActions'
import ChartInfoTooltip from '@/components/ui/ChartInfoTooltip'
import WidgetErrorBoundary from '@/components/ui/WidgetErrorBoundary'
import { useCustomersPageData } from '@/hooks/useDashboardData'
import { formatNumber } from '@/lib/utils'
import { useDataset } from '@/hooks/useDataset'
import { useFilterStore } from '@/lib/store'
import { generateActions } from '@/lib/recommendations'
import { generateCustomerInsights } from '@/lib/insights'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const SegmentDonut = dynamic(() => import('@/components/charts/SegmentDonut'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const RFMScatter = dynamic(() => import('@/components/charts/RFMScatter'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const SegmentRevenueBar = dynamic(() => import('@/components/charts/SegmentRevenueBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CLVHistogram = dynamic(() => import('@/components/charts/CLVHistogram'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CountryTreemap = dynamic(() => import('@/components/charts/CountryTreemap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CustomersTable = dynamic(() => import('@/components/tables/CustomersTable'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })

export default function CustomersPage() {
  const data = useCustomersPageData()
  
  const { aggregated } = useDataset()
  const spark = data.segmentRevenueData.map((m) => m.VIP + m.Regular + m.New + m['At-Risk'])
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const insights = generateCustomerInsights(aggregated, filterState)
  const actions = generateActions(aggregated, filterState)

  return (
    <div className="space-y-6">
      <FilterBar />
      <InsightBanner insights={insights} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <KPICard title="VIP count" value={formatNumber(data.kpi.vip)} delta={0} icon={<Crown className="h-4 w-4 text-[#8b5cf6]" />} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Regular count" value={formatNumber(data.kpi.regular)} delta={0} icon={<Users className="h-4 w-4 text-[#6366f1]" />} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="At-Risk count" value={formatNumber(data.kpi.atRisk)} delta={0} icon={<AlertCircle className="h-4 w-4 text-[#f59e0b]" />} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg CLV" value={data.kpi.avgCLV.toFixed(2)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="sc xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Segment distribution</h3>
            <ChartInfoTooltip text="Shows customer mix by value segment to track health of loyalty and acquisition strategy." />
          </div>
          <WidgetErrorBoundary title="Segment distribution">
            <SegmentDonut data={data.donutData} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">RFM scatter</h3>
            <ChartInfoTooltip text="Visualizes customer value by combining recency, frequency, and monetary behavior." />
          </div>
          <WidgetErrorBoundary title="RFM scatter">
            <RFMScatter data={data.scatterData} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="sc xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Segment revenue contribution</h3>
            <ChartInfoTooltip text="Shows monthly revenue contribution split by customer segments to guide retention spend." />
          </div>
          <WidgetErrorBoundary title="Segment revenue contribution">
            <SegmentRevenueBar data={data.segmentRevenueData} />
          </WidgetErrorBoundary>
        </article>
        <article className="sc xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">CLV distribution</h3>
            <ChartInfoTooltip text="Highlights customer lifetime value spread to identify high-value growth and long-tail risk." />
          </div>
          <WidgetErrorBoundary title="CLV distribution">
            <CLVHistogram data={data.clvHistogramData} />
          </WidgetErrorBoundary>
        </article>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Revenue treemap by country</h3>
          <ChartInfoTooltip text="Shows market concentration by country to prioritize localization and expansion strategy." />
        </div>
        <WidgetErrorBoundary title="Revenue treemap by country">
          <CountryTreemap data={data.treemapData} />
        </WidgetErrorBoundary>
      </section>

      <WidgetErrorBoundary title="Customers table">
        <CustomersTable rows={data.tableRows} />
      </WidgetErrorBoundary>
      <RecommendedActions actions={actions} />
    </div>
  )
}








