"use client";

import { useState, useEffect } from "react";
import { KPICard } from "@/components/common/KPICard";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DataTable } from "@/components/common/DataTable";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ApiClient } from "@/lib/apiClient";

interface ReturnsAnalysisData {
  return_rate: number;
  total_returns: number;
  total_refund: number;
  most_returned_category: string;
  returns_by_category: Array<{
    category: string;
    returns: number;
    total_orders: number;
  }>;
  returns_over_time: Array<{
    month: string;
    returns: number;
    total_orders: number;
  }>;
  return_distribution: Array<{
    type: string;
    value: number;
  }>;
}

interface ReturnsAnalysisResponse {
  status: "ok" | "unavailable" | "error";
  data?: ReturnsAnalysisData;
  reason?: string;
  error?: string;
}

interface ReturnsAnalysisProps {
  datasetId: string;
  error?: string;
  onRetry?: () => void;
}

export const ReturnsAnalysis: React.FC<ReturnsAnalysisProps> = ({ 
  datasetId, 
  error, 
  onRetry 
}) => {
  const [returnsData, setReturnsData] = useState<ReturnsAnalysisData | null>(null);
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
        console.warn('Browser extension communication error ignored in ReturnsAnalysis');
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const fetchReturnsAnalysis = async () => {
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
        const url = `/api/dataset/${datasetId}/returns-analysis${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get<ReturnsAnalysisResponse>(url);
        
        if (response.data) {
          if (response.data.status === 'unavailable') {
            setApiError(response.data.reason || 'Returns analysis not available');
          } else if (response.data.status === 'error') {
            setApiError(response.data.error || 'Returns analysis failed');
          } else if (response.data.data) {
            setReturnsData(response.data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch returns analysis:', error);
        setApiError('Failed to load returns analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchReturnsAnalysis();
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
          <h3 className="text-red-800 font-semibold mb-2">Unable to load returns analysis</h3>
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

  if (!returnsData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-semibold mb-2">No returns data available</h3>
          <p className="text-yellow-600">Returns analysis could not be loaded.</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const pieChartData = returnsData.return_distribution.map(item => ({
    name: item.type,
    value: item.value
  }));

  const barChartData = returnsData.returns_by_category.map(item => ({
    name: item.category,
    value: item.returns
  }));

  const lineChartData = returnsData.returns_over_time.map(item => ({
    name: item.month,
    value: item.returns
  }));

  // Prepare table data with calculated return rate
  const tableData = returnsData.returns_by_category.map(item => ({
    ...item,
    return_rate: ((item.returns / item.total_orders) * 100).toFixed(2)
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
          label="Return Rate"
          value={`${(returnsData.return_rate * 100).toFixed(2)}%`}
          color="text-red-600"
        />
        <KPICard
          label="Total Returns"
          value={returnsData.total_returns.toLocaleString()}
          color="text-orange-600"
        />
        <KPICard
          label="Total Refund Amount"
          value={`$${returnsData.total_refund.toLocaleString()}`}
          color="text-purple-600"
        />
        <KPICard
          label="Most Returned Category"
          value={returnsData.most_returned_category || "N/A"}
          color="text-blue-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Returns Over Time Line Chart */}
        <LineChart
          title="Returns Over Time"
          data={lineChartData}
          xLabel="Month"
          yLabel="Returns"
          color="#ef4444"
        />

        {/* Return Distribution Pie Chart */}
        <PieChart
          title="Return Distribution"
          data={pieChartData}
        />
      </div>

      {/* Returns by Category Bar Chart */}
      {returnsData.returns_by_category.length > 0 && (
        <BarChart
          title="Returns by Category"
          data={barChartData}
          xLabel="Category"
          yLabel="Returns"
        />
      )}

      {/* Returns Table */}
      {returnsData.returns_by_category.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Returns by Category Details</h3>
          </div>
          <div className="p-4">
            <DataTable
              headers={[
                {
                  key: "category",
                  label: "Category",
                  sortable: true,
                },
                {
                  key: "returns",
                  label: "Returns",
                  sortable: true,
                  render: (value: number) => value.toLocaleString(),
                },
                {
                  key: "total_orders",
                  label: "Total Orders",
                  sortable: true,
                  render: (value: number) => value.toLocaleString(),
                },
                {
                  key: "return_rate",
                  label: "Return Rate",
                  sortable: true,
                  render: (value: any) => `${value}%`,
                },
              ]}
              rows={tableData}
            />
          </div>
        </div>
      )}
    </div>
  );
};
