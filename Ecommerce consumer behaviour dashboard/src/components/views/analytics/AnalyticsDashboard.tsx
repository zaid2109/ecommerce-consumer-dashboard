"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/common/Card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { KPICard } from "@/components/common/KPICard";
import { CustomerSegmentation } from "./CustomerSegmentation";
import { PaymentAnalysis } from "./PaymentAnalysis";
import { ReturnsAnalysis } from "./ReturnsAnalysis";
import { ApiClient } from "@/lib/apiClient";

interface DatasetInfo {
  id: string;
  name: string;
  created: string;
  rows: number;
  columns: string[];
  roles: string[];
  modules: string[];
}

interface DashboardData {
  overview?: {
    total_revenue: number;
    total_orders: number;
    avg_order_value: number;
    unique_customers: number;
  };
  customer_segmentation?: any;
  payment_analysis?: any;
  returns?: any;
  dataset_info?: DatasetInfo;
}

interface AnalyticsDashboardProps {
  datasetId: string;
}

const TABS = [
  { id: 'segmentation', label: 'Customer Segmentation', icon: '👥' },
  { id: 'payments', label: 'Payment Analysis', icon: '💳' },
  { id: 'returns', label: 'Returns & Refunds', icon: '🔄' },
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ datasetId }) => {
  const [activeTab, setActiveTab] = useState('segmentation');
  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const api = new ApiClient({ baseUrl: "" });

  // Add error handling for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored in AnalyticsDashboard');
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!datasetId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch dashboard data
        const dashboardResponse = await api.get<DashboardData>(`/api/dataset/${datasetId}/dashboard`);
        
        if (dashboardResponse.data) {
          setDashboardData(dashboardResponse.data);
          
          // Extract dataset info from response or fetch separately
          if (dashboardResponse.data.dataset_info) {
            setDatasetInfo(dashboardResponse.data.dataset_info);
          } else {
            // Fetch dataset info separately
            try {
              const datasetResponse = await api.get(`/api/datasets`);
              if (datasetResponse.data && Array.isArray(datasetResponse.data) && datasetResponse.data.length > 0) {
                const currentDataset = datasetResponse.data.find((d: any) => d.id === datasetId);
                if (currentDataset) {
                  setDatasetInfo(currentDataset);
                }
              }
            } catch (err) {
              console.warn('Could not fetch dataset info:', err);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [datasetId, refreshKey]);

  const handleRetry = () => {
    setRefreshKey(prev => prev + 1);
  };

  const renderOverview = () => {
    if (!dashboardData.overview) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Overview Not Available</h3>
          <p className="text-yellow-600">Overview analytics could not be loaded for this dataset.</p>
        </div>
      );
    }

    const { total_revenue, total_orders, avg_order_value, unique_customers } = dashboardData.overview;

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Revenue"
            value={`$${total_revenue?.toLocaleString() || 'N/A'}`}
            color="text-green-600"
          />
          <KPICard
            label="Total Orders"
            value={total_orders?.toLocaleString() || 'N/A'}
            color="text-blue-600"
          />
          <KPICard
            label="Avg Order Value"
            value={`$${avg_order_value?.toFixed(2) || 'N/A'}`}
            color="text-purple-600"
          />
          <KPICard
            label="Unique Customers"
            value={unique_customers?.toLocaleString() || 'N/A'}
            color="text-orange-600"
          />
        </div>

        {/* Dataset Info */}
        {datasetInfo && (
          <Card title="Dataset Information">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Rows</p>
                <p className="text-lg font-semibold">{datasetInfo.rows?.toLocaleString() || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Columns</p>
                <p className="text-lg font-semibold">{datasetInfo.columns?.length || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Roles</p>
                <p className="text-lg font-semibold">{datasetInfo.roles?.length || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Analytics Modules</p>
                <p className="text-lg font-semibold">{datasetInfo.modules?.length || 'N/A'}</p>
              </div>
            </div>
            
            {datasetInfo.roles && datasetInfo.roles.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Detected Data Roles:</p>
                <div className="flex flex-wrap gap-2">
                  {datasetInfo.roles.map((role, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      
      case 'segmentation':
        return (
          <CustomerSegmentation
            data={dashboardData.customer_segmentation || {
              total_customers: 0,
              segment_counts: { champions: 0, loyal: 0, potential: 0, at_risk: 0, lost: 0 },
              top_20_percent_revenue: 0,
              rfm_table: [],
              rfm_scatter: []
            }}
            loading={loading}
            error={!dashboardData.customer_segmentation ? 'Customer segmentation data not available' : undefined}
          />
        );
      
      case 'payments':
        return (
          <PaymentAnalysis
            datasetId={datasetId}
            error={!dashboardData.payment_analysis ? 'Payment analysis data not available' : undefined}
            onRetry={handleRetry}
          />
        );
      
      case 'returns':
        return (
          <ReturnsAnalysis
            datasetId={datasetId}
            error={!dashboardData.returns ? 'Returns analysis data not available' : undefined}
            onRetry={handleRetry}
          />
        );
      
      default:
        return (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p>Tab content not available</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton key={i} className="h-32" />
          ))}
        </div>
        <LoadingSkeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Unable to load dashboard</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              {datasetInfo && (
                <p className="text-sm text-gray-500">
                  Dataset: {datasetInfo.name || datasetId} • {datasetInfo.rows?.toLocaleString()} rows
                </p>
              )}
            </div>
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </div>
    </div>
  );
};
