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
  rows: number;
  columns: string[];
  roles: string[];
  modules: string[];
}

interface AnalyticsIntegrationProps {
  datasetId: string;
}

type SchemaResponse = {
  status: string;
  data?: {
    schema?: Record<string, unknown>;
    roles?: Record<string, unknown>;
    modules?: string[];
  };
};

const TABS = [
  { id: 'segmentation', label: 'Customer Segmentation', icon: '👥' },
  { id: 'payments', label: 'Payment Analysis', icon: '💳' },
  { id: 'returns', label: 'Returns & Refunds', icon: '🔄' },
];

export const AnalyticsIntegration: React.FC<AnalyticsIntegrationProps> = ({ datasetId }) => {
  const [activeTab, setActiveTab] = useState('segmentation');
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = new ApiClient({ baseUrl: "" });

  // Add error handling for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored in AnalyticsIntegration');
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const fetchDatasetInfo = async () => {
      if (!datasetId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch dataset schema to get info
        const schemaResponse = await api.get<SchemaResponse>(
          `/api/schema?dataset_id=${datasetId}`
        );
        
        if (schemaResponse.data && schemaResponse.data.data) {
          const { schema, roles, modules } = schemaResponse.data.data;
          
          setDatasetInfo({
            id: datasetId,
            name: `Dataset ${datasetId.slice(-8)}`, // Show last 8 chars of ID
            rows: Object.keys(schema || {}).length || 0, // Approximate row count
            columns: Object.keys(schema || {}),
            roles: Object.keys(roles || {}),
            modules: modules || []
          });
        }
      } catch (error) {
        console.error('Failed to fetch dataset info:', error);
        setError('Failed to load dataset information');
      } finally {
        setLoading(false);
      }
    };

    fetchDatasetInfo();
  }, [datasetId]);

  const renderOverview = () => {
    if (!datasetInfo) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Dataset Not Available</h3>
          <p className="text-yellow-600">Could not load dataset information. Please check if the dataset is properly uploaded.</p>
        </div>
      );
    }

    const hasModule = (module: string) => datasetInfo.modules.includes(module);

    return (
      <div className="space-y-6">
        {/* Dataset Info */}
        <Card title="Dataset Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Dataset ID</p>
              <p className="text-lg font-semibold">{datasetInfo.id.slice(-8)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Columns</p>
              <p className="text-lg font-semibold">{datasetInfo.columns.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data Roles</p>
              <p className="text-lg font-semibold">{datasetInfo.roles.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Analytics Modules</p>
              <p className="text-lg font-semibold">{datasetInfo.modules.length}</p>
            </div>
          </div>
          
          {datasetInfo.roles.length > 0 && (
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

        {/* Module Availability */}
        <Card title="Analytics Modules Availability">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${hasModule('kpis') ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold mb-1">Overview KPIs</h4>
              <p className={`text-sm ${hasModule('kpis') ? 'text-green-600' : 'text-gray-500'}`}>
                {hasModule('kpis') ? '✅ Available' : '❌ Not Available'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${hasModule('customer_segmentation') ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-2xl mb-2">👥</div>
              <h4 className="font-semibold mb-1">Customer Segmentation</h4>
              <p className={`text-sm ${hasModule('customer_segmentation') ? 'text-green-600' : 'text-gray-500'}`}>
                {hasModule('customer_segmentation') ? '✅ Available' : '❌ Not Available'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${hasModule('payment') ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-2xl mb-2">💳</div>
              <h4 className="font-semibold mb-1">Payment Analysis</h4>
              <p className={`text-sm ${hasModule('payment') ? 'text-green-600' : 'text-gray-500'}`}>
                {hasModule('payment') ? '✅ Available' : '❌ Not Available'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${hasModule('returns') ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-2xl mb-2">🔄</div>
              <h4 className="font-semibold mb-1">Returns & Refunds</h4>
              <p className={`text-sm ${hasModule('returns') ? 'text-green-600' : 'text-gray-500'}`}>
                {hasModule('returns') ? '✅ Available' : '❌ Not Available'}
              </p>
            </div>
          </div>
        </Card>

        {/* Data Quality Summary */}
        <Card title="Data Quality & Analytics Readiness">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Customer Data</span>
              <span className={`px-2 py-1 rounded text-xs ${datasetInfo.roles.includes('customer_id') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {datasetInfo.roles.includes('customer_id') ? '✅ Available' : '❌ Missing'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Revenue Data</span>
              <span className={`px-2 py-1 rounded text-xs ${datasetInfo.roles.includes('revenue') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {datasetInfo.roles.includes('revenue') ? '✅ Available' : '❌ Missing'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Timestamp Data</span>
              <span className={`px-2 py-1 rounded text-xs ${datasetInfo.roles.includes('timestamp') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {datasetInfo.roles.includes('timestamp') ? '✅ Available' : '❌ Missing'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Payment Method Data</span>
              <span className={`px-2 py-1 rounded text-xs ${datasetInfo.roles.includes('payment') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {datasetInfo.roles.includes('payment') ? '✅ Available' : '⚠️ Optional'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Return Data</span>
              <span className={`px-2 py-1 rounded text-xs ${datasetInfo.roles.includes('return_status') || datasetInfo.roles.includes('return_flag') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {datasetInfo.roles.includes('return_status') || datasetInfo.roles.includes('return_flag') ? '✅ Available' : '⚠️ Optional'}
              </span>
            </div>
          </div>
        </Card>
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
            data={{
              total_customers: 0,
              segment_counts: { champions: 0, loyal: 0, potential: 0, at_risk: 0, lost: 0 },
              top_20_percent_revenue: 0,
              rfm_table: [],
              rfm_scatter: []
            }}
            loading={false}
            error={undefined}
          />
        );
      
      case 'payments':
        return (
          <PaymentAnalysis
            datasetId={datasetId}
            error={undefined}
            onRetry={() => window.location.reload()}
          />
        );
      
      case 'returns':
        return (
          <ReturnsAnalysis
            datasetId={datasetId}
            error={undefined}
            onRetry={() => window.location.reload()}
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
        <LoadingSkeleton className="h-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Unable to load analytics</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
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
                  Dataset: {datasetInfo.name} • {datasetInfo.columns.length} columns • {datasetInfo.roles.length} data roles
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
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
            {TABS.map((tab) => {
              const isAvailable = tab.id === 'overview' || 
                               (tab.id === 'segmentation' && datasetInfo?.modules.includes('customer_segmentation')) ||
                               (tab.id === 'payments' && datasetInfo?.modules.includes('payment')) ||
                               (tab.id === 'returns' && datasetInfo?.modules.includes('returns'));
              
              return (
                <button
                  key={tab.id}
                  onClick={() => isAvailable && setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    !isAvailable
                      ? 'border-transparent text-gray-300 cursor-not-allowed'
                      : activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={!isAvailable}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  {!isAvailable && <span className="ml-1 text-xs">(N/A)</span>}
                </button>
              );
            })}
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
