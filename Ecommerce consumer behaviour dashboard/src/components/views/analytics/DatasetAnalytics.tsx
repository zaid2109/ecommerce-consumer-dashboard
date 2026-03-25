"use client";

import { useState, useEffect } from "react";
import { AnalyticsIntegration } from "./AnalyticsIntegration";
import { ApiClient } from "@/lib/apiClient";

interface DatasetAnalyticsProps {
  datasetId?: string;
}

export const DatasetAnalytics: React.FC<DatasetAnalyticsProps> = ({ datasetId }) => {
  const [currentDatasetId, setCurrentDatasetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const api = new ApiClient({ baseUrl: "" });

  useEffect(() => {
    const findActiveDataset = async () => {
      setLoading(true);
      
      if (datasetId) {
        setCurrentDatasetId(datasetId);
      } else {
        // Try to find the most recent dataset
        try {
          const response = await api.get("/api/datasets");
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            // Use the first available dataset
            setCurrentDatasetId(response.data[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch datasets:", error);
        }
      }
      
      setLoading(false);
    };

    findActiveDataset();
  }, [datasetId]);

  // Add error handling for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored in DatasetAnalytics');
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!currentDatasetId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Dataset Available</h2>
          <p className="text-gray-600 mb-4">
            Please upload a dataset to view analytics.
          </p>
          <button
            onClick={() => window.location.href = '/upload'}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Upload Dataset
          </button>
        </div>
      </div>
    );
  }

  return <AnalyticsIntegration datasetId={currentDatasetId} />;
};
