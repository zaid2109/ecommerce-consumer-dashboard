'use client'

import dynamic from 'next/dynamic'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import InsightBanner from '@/components/cards/InsightBanner'
import RecommendedActions from '@/components/cards/RecommendedActions'
import ChartInfoTooltip from '@/components/ui/ChartInfoTooltip'
import { useProductsData } from '@/hooks/useCommerceData'
import { useFilterStore } from '@/lib/store'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import SimpleCsvTable from '@/components/tables/SimpleCsvTable'
import { useDataset } from '@/hooks/useDataset'
import { generateActions } from '@/lib/recommendations'
import { generateProductInsights } from '@/lib/insights'

const SparklineChart = dynamic(() => import('@/components/charts/SparklineChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CategoryTreemap = dynamic(() => import('@/components/charts/CategoryTreemap'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CategoryAreaChart = dynamic(() => import('@/components/charts/CategoryAreaChart'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CategoryRadar = dynamic(() => import('@/components/charts/CategoryRadar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const PriceBoxPlot = dynamic(() => import('@/components/charts/PriceBoxPlot'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })
const CategoryMarginBar = dynamic(() => import('@/components/charts/CategoryMarginBar'), { ssr: false, loading: () => <div className="animate-pulse bg-[#f1f5f9] dark:bg-[#1e2433] rounded-xl h-72" /> })

export default function ProductsPage() {
  const data = useProductsData()
  
  const { aggregated } = useDataset()
  const setCategories = useFilterStore((s) => s.setCategories)
  const filterState = useFilterStore((s) => ({
    dateRange: s.dateRange,
    categories: s.categories,
    segments: s.segments,
    countries: s.countries,
    paymentMethods: s.paymentMethods,
    activePage: s.activePage,
  }))
  const insights = generateProductInsights(aggregated, filterState)
  const actions = generateActions(aggregated, filterState)
  const spark = data.areaData.map((r) => Number(r[data.kpi.topCategory as keyof typeof r] ?? 0))

  const tableRows = data.categoryTable.map((r) => [
    r.category,
    r.orders,
    formatCurrency(r.grossRevenue),
    formatCurrency(r.returnsValue),
    formatCurrency(r.netRevenue),
    formatPercent(r.returnRate * 100, 1),
    r.avgRating.toFixed(2),
    formatPercent(r.momGrowth, 1),
  ])

  return (
    <div className="space-y-6">
      <FilterBar />
      <InsightBanner insights={insights} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <KPICard title="Top Category" value={data.kpi.topCategory} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Total SKUs (estimated)" value={formatNumber(data.kpi.totalSkus)} delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Avg Order Value" value={data.kpi.avgOrderValue.toFixed(2)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
        <KPICard title="Revenue per Order" value={data.kpi.revenuePerOrder.toFixed(2)} prefix="$" delta={0} sparklineData={spark} SparklineComponent={SparklineChart} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="sc xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Category map</h3>
            <ChartInfoTooltip text="Compares category revenue footprint while encoding return pressure via color intensity." />
          </div>
          <CategoryTreemap data={data.treemapData} onSelectCategory={(c) => setCategories([c])} />
        </article>
        <article className="sc xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Category trend</h3>
            <ChartInfoTooltip text="Shows 24-month stacked contribution by category to expose portfolio momentum shifts." />
          </div>
          <CategoryAreaChart data={data.areaData} categories={data.categoryTable.map((r) => r.category)} />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <article className="sc xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Category radar</h3>
            <ChartInfoTooltip text="Balances revenue, orders, pricing, rating, and return performance across selected categories." />
          </div>
          <CategoryRadar data={data.radarData} />
        </article>
        <article className="sc xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="sc-title">Price distribution</h3>
            <ChartInfoTooltip text="Visualizes pricing spread and median by category to identify outliers and margin opportunities." />
          </div>
          <PriceBoxPlot data={data.boxPlotData} />
        </article>
      </section>

      <section className="sc">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="sc-title">Gross vs returns</h3>
          <ChartInfoTooltip text="Compares gross revenue against return value to reveal true category net contribution." />
        </div>
        <CategoryMarginBar data={data.marginData} />
      </section>

      <SimpleCsvTable
        title="Category performance"
        filename="products-category-performance.csv"
        columns={['Category', 'Orders', 'Gross Revenue', 'Returns Value', 'Net Revenue', 'Return Rate%', 'Avg Rating', 'MoM Growth%']}
        rows={tableRows}
      />

      <RecommendedActions actions={actions} />
    </div>
  )
}








