"use client";

import { useState, useEffect } from "react";
import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

const CategoryRevenuePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/dataset/ds_sales_default/dashboard');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch category data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const categories = data?.data?.modules?.find((m: any) => m.id === 'revenue-by-category')?.data?.categories || [];

  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Category Revenue">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Category Revenue</h1>
          <p className="text-gray-600 mt-1">Revenue breakdown by city/category</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <Card title="Top Cities by Revenue">
            <div className="pt-4">
              <div className="space-y-3">
                {categories.slice(0, 10).map((city: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-900">{city.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(city.revenue)}</div>
                      <div className="text-sm text-gray-500">{((city.revenue / categories.reduce((sum: number, c: any) => sum + c.revenue, 0)) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card title="Category Summary">
          <div className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Cities</p>
                <p className="font-semibold">{categories.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Top City</p>
                <p className="font-semibold">{categories[0]?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Revenue/City</p>
                <p className="font-semibold">{formatCurrency(categories.reduce((sum: number, c: any) => sum + c.revenue, 0) / categories.length)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="font-semibold">{formatCurrency(categories.reduce((sum: number, c: any) => sum + c.revenue, 0))}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default CategoryRevenuePage;
