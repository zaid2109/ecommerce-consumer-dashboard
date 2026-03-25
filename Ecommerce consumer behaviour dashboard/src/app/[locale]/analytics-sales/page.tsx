"use client";

import { useState, useEffect } from "react";
import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

interface DashboardData {
  status: string;
  data: {
    modules: Array<{
      id: string;
      title: string;
      status: string;
      data?: {
        revenue?: number;
        orders?: number;
        quantity?: number;
        series?: Array<{ bucket: string; value: number }>;
        categories?: Array<{ name: string; revenue: number }>;
      };
    }>;
  };
}

const SalesAnalytics = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/dataset/ds_sales_default/dashboard');
        const data: DashboardData = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError('Failed to load analytics data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const formatCurrency = (value: number | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value: number | undefined) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  if (loading) {
    return (
      <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Sales Analytics">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Sales Analytics">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-semibold text-red-800 mb-2">Analytics Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const kpis = dashboardData?.data?.modules?.find((m: any) => m.id === 'kpis')?.data || {};
  const timeSeries = dashboardData?.data?.modules?.find((m: any) => m.id === 'time-series')?.data?.series || [];
  const revenueByCity = dashboardData?.data?.modules?.find((m: any) => m.id === 'revenue-by-category')?.data?.categories || [];

  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Sales Analytics">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">
                📊 Sales.csv • {formatNumber(1048575)} rows • Real-time analytics
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Live Data</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Revenue">
            <div className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(kpis.revenue)}
              </div>
              <p className="text-sm text-gray-500 mt-1">All time revenue</p>
            </div>
          </Card>
          
          <Card title="Total Orders">
            <div className="pt-4">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(kpis.orders)}
              </div>
              <p className="text-sm text-gray-500 mt-1">Unique orders</p>
            </div>
          </Card>
          
          <Card title="Total Quantity">
            <div className="pt-4">
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(kpis.quantity)}
              </div>
              <p className="text-sm text-gray-500 mt-1">Items sold</p>
            </div>
          </Card>
          
          <Card title="Avg Order Value">
            <div className="pt-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency((kpis.revenue || 0) / (kpis.orders || 1))}
              </div>
              <p className="text-sm text-gray-500 mt-1">Per order</p>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Over Time */}
          <Card title="Revenue Over Time">
            <div className="pt-4">
              <div className="h-64">
                {timeSeries.length > 0 ? (
                  <div className="space-y-2">
                    {timeSeries.slice(-6).map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">{item.bucket}</span>
                        <span className="font-semibold">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No time series data available
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Top Cities by Revenue */}
          <Card title="Top Cities by Revenue">
            <div className="pt-4">
              <div className="h-64">
                {revenueByCity.length > 0 ? (
                  <div className="space-y-2">
                    {revenueByCity.slice(0, 8).map((city: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">{city.name}</span>
                        <span className="font-semibold">{formatCurrency(city.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No city data available
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Data Summary */}
        <Card title="Dataset Summary">
          <div className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Source File</p>
                <p className="font-semibold">Sales.csv</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Rows</p>
                <p className="font-semibold">{formatNumber(1048575)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Columns</p>
                <p className="font-semibold">13</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date Range</p>
                <p className="font-semibold">2022 Data</p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Available Analytics:</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅ Revenue Analysis</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅ Order Tracking</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅ City Performance</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✅ Time Series</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default SalesAnalytics;
