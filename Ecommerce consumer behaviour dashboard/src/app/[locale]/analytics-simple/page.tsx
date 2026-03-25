"use client";

import { useState } from "react";
import { PageWrapper } from "../../../components/common/PageWrapper";

const SimpleAnalytics = () => {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <PageWrapper
      className="px-4 pt-28 pb-4 xl:p-0"
      hidePaper
      pageName="Analytics"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            E-Commerce Analytics Dashboard
          </h1>
          <p className="text-gray-600 mb-8">
            Complete analytics system with customer segmentation, payment analysis, and returns tracking.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl mb-2">👥</div>
              <h3 className="font-semibold text-blue-900">Customer Segmentation</h3>
              <p className="text-sm text-blue-700">RFM Analysis & Customer Insights</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl mb-2">💳</div>
              <h3 className="font-semibold text-green-900">Payment Analysis</h3>
              <p className="text-sm text-green-700">Payment Methods & Revenue Tracking</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl mb-2">🔄</div>
              <h3 className="font-semibold text-purple-900">Returns & Refunds</h3>
              <p className="text-sm text-purple-700">Return Analysis & Loss Tracking</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl mb-2">📈</div>
              <h3 className="font-semibold text-orange-900">Overview Dashboard</h3>
              <p className="text-sm text-orange-700">KPIs & Executive Metrics</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm">Frontend: Running</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-sm">Backend: Needs Setup</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm">Analytics: Ready</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              📤 Upload Dataset
            </button>
            <button
              onClick={() => window.location.href = '/en/data'}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              📁 Data Management
            </button>
          </div>
          
          {showUpload && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
              <h3 className="font-semibold text-blue-900 mb-2">📤 Upload Instructions</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Prepare your CSV file with columns: order_id, customer_id, revenue, timestamp, etc.</li>
                <li>Go to Data Management page to upload your dataset</li>
                <li>Once uploaded, return here to view analytics</li>
                <li>System will automatically detect available analytics modules</li>
              </ol>
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 Available Analytics Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">📊 Executive Dashboard</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Total Revenue & Orders</li>
                <li>• Average Order Value</li>
                <li>• Customer Growth Trends</li>
                <li>• Revenue Over Time</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">👥 Customer Insights</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• RFM Segmentation</li>
                <li>• Customer Lifetime Value</li>
                <li>• Purchase Frequency Analysis</li>
                <li>• Customer Retention Metrics</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">💳 Payment Analytics</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Payment Method Distribution</li>
                <li>• Revenue by Payment Type</li>
                <li>• Online vs COD Analysis</li>
                <li>• Payment Failure Rates</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">🔄 Returns Management</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Return Rate Analysis</li>
                <li>• Returns by Category</li>
                <li>• Refund Amount Tracking</li>
                <li>• Return Trend Analysis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default SimpleAnalytics;
