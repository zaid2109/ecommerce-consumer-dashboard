"use client";

import { useState, useEffect } from "react";
import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

const CustomerSegmentationPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/dataset/ds_sales_default/dashboard');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch segmentation data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Customer Segmentation">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Customer Segmentation</h1>
          <p className="text-gray-600 mt-1">RFM Analysis and customer insights</p>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="High Value Customers">
              <div className="pt-4">
                <div className="text-3xl font-bold text-green-600">2,847</div>
                <p className="text-sm text-gray-500 mt-2">Top 10% by revenue</p>
                <div className="mt-4 text-sm text-gray-600">
                  • Average order: $2,450<br/>
                  • 12+ orders per year<br/>
                  • High retention rate
                </div>
              </div>
            </Card>

            <Card title="Medium Value Customers">
              <div className="pt-4">
                <div className="text-3xl font-bold text-blue-600">8,541</div>
                <p className="text-sm text-gray-500 mt-2">Middle 30% by revenue</p>
                <div className="mt-4 text-sm text-gray-600">
                  • Average order: $850<br/>
                  • 4-8 orders per year<br/>
                  • Moderate retention
                </div>
              </div>
            </Card>

            <Card title="Low Value Customers">
              <div className="pt-4">
                <div className="text-3xl font-bold text-orange-600">15,234</div>
                <p className="text-sm text-gray-500 mt-2">Bottom 60% by revenue</p>
                <div className="mt-4 text-sm text-gray-600">
                  • Average order: $125<br/>
                  • 1-3 orders per year<br/>
                  • Low retention rate
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card title="RFM Analysis">
          <div className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Recency Distribution</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-sm">0-30 days</span>
                    <span className="font-semibold">35%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-sm">31-90 days</span>
                    <span className="font-semibold">40%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <span className="text-sm">90+ days</span>
                    <span className="font-semibold">25%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Frequency Distribution</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-sm">10+ orders</span>
                    <span className="font-semibold">15%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-sm">5-9 orders</span>
                    <span className="font-semibold">30%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <span className="text-sm">1-4 orders</span>
                    <span className="font-semibold">55%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default CustomerSegmentationPage;
