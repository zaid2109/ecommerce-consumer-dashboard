'use client'

import { useMemo, useState } from 'react'
import { FilterBar } from '@/components/layout/FilterBar'
import KPICard from '@/components/cards/KPICard'
import TopProductsTable from '@/components/cards/TopProductsTable'
import ActivityFeed from '@/components/cards/ActivityFeed'
import SparklineChart from '@/components/charts/SparklineChart'
import RevenueLineChart from '@/components/charts/RevenueLineChart'
import WeeklyBarChart from '@/components/charts/WeeklyBarChart'
import CategoryDonutChart from '@/components/charts/CategoryDonutChart'
import {
  useActivityEvents,
  useCategoryData,
  useCountryRevenueData,
  useDailyRevenue,
  useKPIData,
  useRatingDistributionData,
  useWeeklyPerformanceData,
} from '@/hooks/useChartData'
import { formatCurrency, formatNumber, getFlagEmoji } from '@/lib/utils'

const GRANULARITY_OPTIONS = ['day', 'week', 'month', 'year'] as const

export default function DashboardPage() {
  const [granularity, setGranularity] = useState<(typeof GRANULARITY_OPTIONS)[number]>('day')
  const kpi = useKPIData()
  const categoryData = useCategoryData()
  const activityEvents = useActivityEvents()
  const weeklyData = useWeeklyPerformanceData()
  const countryData = useCountryRevenueData().slice(0, 6)
  const ratingData = useRatingDistributionData()

  const chartGranularity = granularity === 'day' ? 'daily' : granularity === 'week' ? 'weekly' : 'monthly'
  const revenueSeries = useDailyRevenue(chartGranularity)

  const sparkline30d = useMemo(() => revenueSeries.slice(-30).map((point) => point.net), [revenueSeries])
  const avgRating = useMemo(() => ratingData.average.toFixed(1), [ratingData.average])
  const donutData = useMemo(
    () => [
      { name: '5★', value: ratingData.counts['5'], color: '#10b981' },
      { name: '4★', value: ratingData.counts['4'], color: '#6366f1' },
      { name: '3★', value: ratingData.counts['3'], color: '#8b5cf6' },
      { name: '2★', value: ratingData.counts['2'], color: '#f59e0b' },
      { name: '1★', value: ratingData.counts['1'], color: '#ef4444' },
    ],
    [ratingData.counts]
  )

  const orderRing = Math.max(10, Math.min(95, Math.round((kpi.totalOrders / Math.max(kpi.activeCustomers, 1)) * 10)))
  const customerRing = Math.max(8, Math.min(90, 100 - orderRing))

  return (
    <div className="space-y-6">
      <FilterBar />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KPICard title="Sales" value={formatCurrency(kpi.totalRevenue)} delta={12.5} deltaLabel="Last 3 weeks" variant="ring" ringPercent={37} sparklineData={sparkline30d} SparklineComponent={SparklineChart} />
        <KPICard title="Orders" value={formatNumber(kpi.totalOrders)} delta={Math.max(0.1, kpi.deltas.orders)} deltaLabel="Last 3 weeks" variant="ring" ringPercent={orderRing} sparklineData={sparkline30d} SparklineComponent={SparklineChart} />
        <KPICard title="Customers" value={formatNumber(kpi.activeCustomers)} delta={-Math.max(0.1, Math.abs(kpi.deltas.customers))} deltaLabel="Last 3 weeks" variant="ring" ringPercent={customerRing} sparklineData={sparkline30d} SparklineComponent={SparklineChart} />
        <KPICard title="Return Rate" value={kpi.returnRate.toFixed(1)} suffix="%" delta={kpi.deltas.returnRate} deltaLabel="Last 3 weeks" variant="sparkline" sparklineData={sparkline30d} sparklineColor="#ef4444" SparklineComponent={SparklineChart} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 sc">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="sc-title">Revenue over time</h3>
              <p className="text-[12px] text-tx-secondary dark:text-tx-muted mt-0.5">Historical performance</p>
            </div>
            <div className="toggle-group">
              {['Day', 'Week', 'Month', 'Year'].map((g) => {
                const key = g.toLowerCase() as (typeof GRANULARITY_OPTIONS)[number]
                return (
                  <button key={g} onClick={() => setGranularity(key)} className={`toggle-pill ${granularity === key ? 'toggle-pill-active' : ''}`}>
                    {g}
                  </button>
                )
              })}
            </div>
          </div>
          <RevenueLineChart data={revenueSeries} granularity={chartGranularity} />
        </div>
        <div className="xl:col-span-2 sc">
          <h3 className="sc-title mb-4">Weekly Performance</h3>
          <WeeklyBarChart data={weeklyData} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-2 sc">
          <TopProductsTable data={categoryData} title="Bestselling products" />
        </div>
        <div className="xl:col-span-2 sc">
          <h3 className="sc-title mb-4">Customer satisfaction</h3>
          <CategoryDonutChart data={donutData} centerLabel={avgRating} />
          <div className="mt-2 flex flex-wrap gap-2">
            {donutData.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] dark:bg-[#1e2433] px-2 py-1 text-[11px] text-tx-secondary dark:text-tx-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
            ))}
          </div>
        </div>
        <div className="xl:col-span-1 sc">
          <ActivityFeed events={activityEvents} />
        </div>
      </div>

      <div className="sc">
        <div className="flex items-center justify-between mb-4">
          <h3 className="sc-title">Revenue per country</h3>
        </div>
        <table className="st w-full">
          <thead>
            <tr>
              <th>Country</th>
              <th className="text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {countryData.map((row) => (
              <tr key={row.country}>
                <td><div className="flex items-center gap-2"><span>{getFlagEmoji(row.country)}</span><span>{row.country}</span></div></td>
                <td className="text-right font-semibold">{formatCurrency(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
