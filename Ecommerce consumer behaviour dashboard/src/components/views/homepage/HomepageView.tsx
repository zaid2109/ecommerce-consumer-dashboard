"use client";

import { useState, useEffect } from "react";
import { Grid, Col } from "@tremor/react";

import { HomeSmallCards } from "./HomeSmallCards";
import { RevenueOverTime } from "./RevenueOverTime";
import { Regions } from "./Regions";
import { BestSellingProducts } from "./BestSellingProducts";
import { CustomerSatisfaction } from "./CustomerSatisfaction";
import { HomepageViewProps } from "./types";

export const HomepageView = ({ homepageData }: HomepageViewProps) => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboardData = async () => {
      try {
        const datasetsResponse = await fetch("/api/datasets", {
          cache: "no-store",
          signal: controller.signal,
        });
        const datasetsPayload = await datasetsResponse.json().catch(() => null);
        const datasets: Array<{ dataset_id?: string; datasetId?: string }> =
          datasetsPayload?.data ?? [];

        const stored = typeof window !== "undefined" ? window.localStorage.getItem("activeDatasetId") ?? "" : "";
        const firstId = datasets[0]?.dataset_id ?? datasets[0]?.datasetId ?? "";
        const datasetId = stored || firstId;
        setActiveDatasetId(datasetId);
        if (!datasetId) {
          setDashboardData(null);
          return;
        }

        const response = await fetch(`/api/dataset/${encodeURIComponent(datasetId)}/dashboard`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        setDashboardData(result);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    return () => controller.abort();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  // Extract real data from dashboard aggregator
  const modules = dashboardData?.data?.modules ?? [];
  const revenueByCategoryModule = modules.find((module: any) => module?.id === "revenue-by-category") ?? null;
  const categories = revenueByCategoryModule?.data?.categories ?? [];
  const totalRevenue = categories.reduce((sum: number, cat: any) => sum + (Number(cat?.revenue) || 0), 0);

  return (
    <>
      {/* Header with Dashboard Links */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">📊 Real-time analytics • Powered by Sales.csv Dataset</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Data</span>
            <a 
              href="/en/dashboard-aggregator" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              🚀 Dashboard Aggregator
            </a>
          </div>
        </div>
      </div>

      {/* First row - KPI Cards */}
      <Grid numItems={2} numItemsLg={4} className="gap-x-4 gap-y-4">
        {homepageData?.homeSmallCards && (
          <HomeSmallCards homeSmallCardsData={homepageData.homeSmallCards} />
        )}
      </Grid>

      {/* Revenue Summary Card */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Total Revenue (Sales.csv)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            <p className="text-sm text-gray-600 mt-1">From {categories.length} categories</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Analytics Modules</p>
            <p className="text-2xl font-bold text-blue-600">5 Active</p>
            <p className="text-sm text-gray-600 mt-1">All modules operational</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Dataset Status</p>
            <p className="text-2xl font-bold text-purple-600">{activeDatasetId ? "Live" : loading ? "Loading" : "Missing"}</p>
            <p className="text-sm text-gray-600 mt-1">{activeDatasetId || "No dataset selected"}</p>
          </div>
        </div>
      </div>

      {/* Second row */}
      <Grid
        numItems={1}
        numItemsSm={2}
        numItemsMd={2}
        numItemsLg={3}
        className="gap-x-4 1xl:gap-x-6 gap-y-6"
      >
        <Col numColSpan={1} numColSpanLg={2}>
          {homepageData?.revenueOverTime && (
            <RevenueOverTime
              revenueOverTimeData={homepageData.revenueOverTime}
            />
          )}
        </Col>
        <Col numColSpan={1} numColSpanLg={1}>
          {homepageData?.regions && (
            <Regions regionsData={homepageData.regions} />
          )}
        </Col>
      </Grid>

      {/* Third row */}
      <Grid
        numItems={1}
        numItemsSm={2}
        numItemsMd={2}
        numItemsLg={3}
        className="gap-x-4 1xl:gap-x-6 gap-y-6"
      >
        <Col numColSpan={1} numColSpanLg={1}>
          {homepageData?.bestSellingProducts && (
            <BestSellingProducts
              bestSellingProductsData={homepageData.bestSellingProducts}
            />
          )}
        </Col>
        <Col numColSpan={1} numColSpanLg={2}>
          {homepageData?.customerSatisfaction && (
            <CustomerSatisfaction
              customerSatisfactionData={homepageData.customerSatisfaction}
            />
          )}
        </Col>
      </Grid>

      {/* Analytics Quick Links */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <a 
            href="/en/dashboard-aggregator"
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">🚀</div>
            <div className="font-medium text-blue-900">Dashboard Aggregator</div>
            <div className="text-xs text-blue-600 mt-1">Complete System</div>
          </a>
          <a 
            href="/en/analytics-sales"
            className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">💰</div>
            <div className="font-medium text-purple-900">Sales Analytics</div>
            <div className="text-xs text-purple-600 mt-1">Revenue Insights</div>
          </a>
          <a 
            href="/en/customer-segmentation"
            className="bg-orange-50 border border-orange-200 rounded-lg p-4 hover:bg-orange-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-medium text-orange-900">Customer Segments</div>
            <div className="text-xs text-orange-600 mt-1">RFM Analysis</div>
          </a>
          <a 
            href="/en/payment-analysis"
            className="bg-pink-50 border border-pink-200 rounded-lg p-4 hover:bg-pink-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">💳</div>
            <div className="font-medium text-pink-900">Payment Analysis</div>
            <div className="text-xs text-pink-600 mt-1">Payment Methods</div>
          </a>
          <a 
            href="/en/returns-refunds"
            className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors text-center"
          >
            <div className="text-2xl mb-2">🔄</div>
            <div className="font-medium text-red-900">Returns & Refunds</div>
            <div className="text-xs text-red-600 mt-1">Return Analysis</div>
          </a>
        </div>
      </div>
    </>
  );
};
