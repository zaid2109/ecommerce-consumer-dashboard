"use client";

import { useState, useEffect } from "react";
import { PageWrapper } from "../../common/PageWrapper";
import { Card } from "../../common/Card";

interface DashboardData {
  purchase_frequency?: { status: string; data?: any; reason?: string };
  category_revenue?: { status: string; data?: any; reason?: string };
  customer_segmentation?: { status: string; data?: any; reason?: string };
  payment_analysis?: { status: string; data?: any; reason?: string };
  returns?: { status: string; data?: any; reason?: string };
}

const DashboardAggregator = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/dataset/ds_sales_default/dashboard');
        const result = await response.json();
        setDashboardData(result);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-600';
      case 'unavailable': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return '✅';
      case 'unavailable': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Dashboard Aggregator">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">E-Commerce Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">
                📊 Real-time analytics aggregator • Sales.csv data
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Purchase Frequency">
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getStatusColor(dashboardData.purchase_frequency?.status || '')}`}>
                  {getStatusIcon(dashboardData.purchase_frequency?.status || '')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {dashboardData.purchase_frequency?.reason || 'Customer purchase patterns'}
              </p>
            </div>
          </Card>

          <Card title="Category Revenue">
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getStatusColor(dashboardData.category_revenue?.status || '')}`}>
                  {getStatusIcon(dashboardData.category_revenue?.status || '')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {dashboardData.category_revenue?.reason || 'Revenue by category'}
              </p>
            </div>
          </Card>

          <Card title="Customer Segmentation">
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getStatusColor(dashboardData.customer_segmentation?.status || '')}`}>
                  {getStatusIcon(dashboardData.customer_segmentation?.status || '')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {dashboardData.customer_segmentation?.reason || 'RFM analysis'}
              </p>
            </div>
          </Card>

          <Card title="Payment Analysis">
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getStatusColor(dashboardData.payment_analysis?.status || '')}`}>
                  {getStatusIcon(dashboardData.payment_analysis?.status || '')}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {dashboardData.payment_analysis?.reason || 'Payment method analysis'}
              </p>
            </div>
          </Card>
        </div>

        {/* Module Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Frequency Details */}
          {dashboardData.purchase_frequency?.status === 'ok' && (
            <Card title="Purchase Frequency Details">
              <div className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Total Orders</p>
                    <p className="font-semibold">{formatNumber(dashboardData.purchase_frequency.data[0]?.total_orders || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unique Customers</p>
                    <p className="font-semibold">{formatNumber(dashboardData.purchase_frequency.data[0]?.unique_customers || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Avg Quantity</p>
                    <p className="font-semibold">{formatNumber(dashboardData.purchase_frequency.data[0]?.avg_quantity || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Repeat Rate</p>
                    <p className="font-semibold">{formatPercent((dashboardData.purchase_frequency.data[0]?.unique_customers || 0) / (dashboardData.purchase_frequency.data[0]?.total_orders || 1))}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Category Revenue Details */}
          {dashboardData.category_revenue?.status === 'ok' && (
            <Card title="Category Revenue Details">
              <div className="pt-4">
                <div className="space-y-3">
                  {dashboardData.category_revenue.data?.slice(0, 8).map((category: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{formatCurrency(category.revenue)}</div>
                        <div className="text-sm text-gray-500">{formatNumber(category.orders)} orders</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* System Status */}
        <Card title="System Status">
          <div className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Backend</p>
                <p className="font-semibold text-green-600">Dashboard Aggregator v2.0</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Modules</p>
                <p className="font-semibold text-blue-600">5 Active</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Dataset</p>
                <p className="font-semibold text-purple-600">Sales.csv</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-semibold text-green-600">Operational</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default DashboardAggregator;
