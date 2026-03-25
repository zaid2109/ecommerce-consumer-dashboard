"use client";

import { useState, useEffect } from "react";
import { KPICard } from "@/components/common/KPICard";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DataTable } from "@/components/common/DataTable";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { ApiClient } from "@/lib/apiClient";

interface PaymentAnalysisData {
  total_transactions: number;
  most_used_method: string;
  overall_avg_order_value: number;
  total_revenue: number;
  payment_table: Array<{
    method: string;
    transactions: number;
    revenue: number;
    avg_order_value: number;
  }>;
  payment_distribution: Array<{
    method: string;
    value: number;
  }>;
  revenue_by_payment: Array<{
    method: string;
    value: number;
  }>;
  online_vs_cod?: Array<{
    payment_type: string;
    count: number;
  }>;
}

interface PaymentAnalysisResponse {
  status: "ok" | "unavailable" | "error";
  data?: PaymentAnalysisData;
  reason?: string;
  error?: string;
}

interface PaymentAnalysisProps {
  datasetId: string;
  error?: string;
  onRetry?: () => void;
}

export const PaymentAnalysis: React.FC<PaymentAnalysisProps> = ({ 
  datasetId, 
  error, 
  onRetry 
}) => {
  const [paymentData, setPaymentData] = useState<PaymentAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    category: "",
    payment_method: ""
  });

  const api = new ApiClient({ baseUrl: "" });

  // Add error handling for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored in PaymentAnalysis');
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const fetchPaymentAnalysis = async () => {
      if (!datasetId) return;

      setLoading(true);
      setApiError(null);

      try {
        // Build query string from filters
        const queryParams = new URLSearchParams();
        if (filters.from_date) queryParams.append('from_date', filters.from_date);
        if (filters.to_date) queryParams.append('to_date', filters.to_date);
        if (filters.category) queryParams.append('category', filters.category);
        if (filters.payment_method) queryParams.append('payment_method', filters.payment_method);
        
        const queryString = queryParams.toString();
        const url = `/api/dataset/${datasetId}/payment-analysis${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get<PaymentAnalysisResponse>(url);
        
        if (response.data) {
          if (response.data.status === 'unavailable') {
            setApiError(response.data.reason || 'Payment analysis not available');
          } else if (response.data.status === 'error') {
            setApiError(response.data.error || 'Payment analysis failed');
          } else if (response.data.data) {
            setPaymentData(response.data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch payment analysis:', error);
        setApiError('Failed to load payment analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentAnalysis();
  }, [datasetId, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (error || apiError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Unable to load payment analysis</h3>
          <p className="text-red-600 mb-4">{error || apiError}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Filter Bar Skeleton */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton key={i} className="h-10" />
            ))}
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton key={i} className="h-32" />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton className="h-96" />
          <LoadingSkeleton className="h-96" />
        </div>

        {/* Table Skeleton */}
        <LoadingSkeleton className="h-96" />
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-semibold mb-2">No payment data available</h3>
          <p className="text-yellow-600">Payment analysis could not be loaded.</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const pieChartData = paymentData.payment_distribution.map(item => ({
    name: item.method,
    value: item.value
  }));

  const barChartData = paymentData.revenue_by_payment.map(item => ({
    name: item.method,
    value: item.value
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              placeholder="Filter by category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <input
              type="text"
              placeholder="Filter by payment method"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.payment_method}
              onChange={(e) => handleFilterChange('payment_method', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Transactions"
          value={paymentData.total_transactions.toLocaleString()}
        />
        <KPICard
          label="Most Used Method"
          value={paymentData.most_used_method || "N/A"}
          color="text-blue-600"
        />
        <KPICard
          label="Total Revenue"
          value={`$${paymentData.total_revenue.toLocaleString()}`}
          color="text-green-600"
        />
        <KPICard
          label="Avg Order Value"
          value={`$${paymentData.overall_avg_order_value.toFixed(2)}`}
          color="text-purple-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Distribution Pie Chart */}
        <PieChart
          title="Payment Method Distribution"
          data={pieChartData}
        />

        {/* Revenue by Payment Bar Chart */}
        <BarChart
          title="Revenue by Payment Method"
          data={barChartData}
          xLabel="Payment Method"
          yLabel="Revenue ($)"
        />
      </div>

      {/* Online vs COD Split (if available) */}
      {paymentData.online_vs_cod && paymentData.online_vs_cod.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Online vs COD Split</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentData.online_vs_cod.map((item) => (
              <div key={item.payment_type} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{item.count.toLocaleString()}</div>
                <div className="text-sm text-gray-600">{item.payment_type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Payment Method Details</h3>
        </div>
        <div className="p-4">
          <DataTable
            headers={[
              {
                key: "method",
                label: "Payment Method",
                sortable: true,
              },
              {
                key: "transactions",
                label: "Transactions",
                sortable: true,
                render: (value: number) => value.toLocaleString(),
              },
              {
                key: "revenue",
                label: "Revenue",
                sortable: true,
                render: (value: number) => `$${value.toLocaleString()}`,
              },
              {
                key: "avg_order_value",
                label: "Avg Order Value",
                sortable: true,
                render: (value: number) => `$${value.toFixed(2)}`,
              },
            ]}
            rows={paymentData.payment_table}
          />
        </div>
      </div>
    </div>
  );
};
