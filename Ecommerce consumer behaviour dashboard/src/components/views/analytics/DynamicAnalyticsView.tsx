"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomerSegmentation } from "./CustomerSegmentation";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "../../common/Card";
import { DashboardErrorBoundary } from "./DashboardErrorBoundary";
import { ApiClient } from "../../../lib/apiClient";

type DatasetListItem = {
  datasetId: string;
  createdAt: string;
  rowCount: number;
  columns: number;
  sourceFileName: string;
  quality?: {
    quality_score: number;
    warnings: string[];
  };
};

type BackendDataset = {
  dataset_id?: string;
  created_at?: string;
  row_count?: number;
  columns?: string[] | number;
  source_file_name?: string;
  datasetId?: string;
  createdAt?: string;
  rowCount?: number;
  sourceFileName?: string;
  quality?: {
    quality_score: number;
    warnings: string[];
  };
  profile?: {
    quality?: {
      quality_score: number;
      warnings: string[];
    };
  };
};

type ModuleResponse = {
  id: string;
  title: string;
  status: "ok" | "unavailable" | "error";
  data?: JsonObject;
  reason?: string;
  errorId?: string;
};

type DashboardResponse = {
  status: "ok";
  data: {
    modules: ModuleResponse[];
    profile?: {
      quality?: {
        quality_score: number;
        warnings: string[];
      };
    };
    filterOptions?: {
      category?: string[];
      paymentMethod?: string[];
    };
  };
};
type UploadResponse = {
  data: {
    dataset_id?: string;
    datasetId?: string;
  };
};

type AnalyticsStatusResponse = {
  status: "pending" | "processing" | "completed";
  available_modules?: string[];
};

type PurchaseFrequencyDashboardPayload = {
  status: "ok" | "unavailable" | "error";
  data?: {
    avg_orders_per_customer?: number;
    repeat_rate?: number;
    active_customers?: number | null;
    avg_purchase_interval?: number | null;
    orders_over_time?: Array<{ date?: string; bucket?: string; orders?: number; order_count?: number }>;
    orders_distribution?: Array<{ orders?: number; customers?: number }>;
    repeat_vs_onetime?: Array<{ name?: string; value?: number } | { segment?: string; customers?: number }>;
    customer_table?: Array<{
      customer_id?: string;
      total_orders?: number;
      last_purchase_date?: string | null;
      avg_order_gap?: number | null;
    }>;
  };
  reason?: string;
  errorId?: string;
};

type TabKey =
  | "purchase-frequency"
  | "category-revenue"
  | "customer-segmentation"
  | "payment-analysis"
  | "returns-refunds";

const TABS: Array<{ id: TabKey; label: string }> = [
  { id: "purchase-frequency", label: "Purchase Frequency" },
  { id: "category-revenue", label: "Category Revenue" },
  { id: "customer-segmentation", label: "Customer Segmentation" },
  { id: "payment-analysis", label: "Payment Analysis" },
  { id: "returns-refunds", label: "Returns & Refunds" },
];

const COLORS = ["#3b82f6", "#22d3ee", "#8b5cf6", "#f97316", "#10b981", "#ef4444"];
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const normalizeErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Request failed");
  }
  return error instanceof Error ? error.message : "Request failed";
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-mainBorder bg-inputBg px-4 py-3">
    <p className="text-xs text-secondaryText">{label}</p>
    <p className="text-lg font-semibold text-primaryText mt-1">{value}</p>
  </div>
);

const StatCardSkeleton = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-mainBorder bg-inputBg px-4 py-3 animate-pulse">
    <p className="text-xs text-secondaryText">{label}</p>
    <div className="mt-2 h-6 w-24 rounded bg-mainBorder/60" />
  </div>
);

const ChartSkeleton = ({ height = 320 }: { height?: number }) => (
  <div className="pt-4 animate-pulse" style={{ height }}>
    <div className="h-full w-full rounded-lg bg-mainBorder/40" />
  </div>
);

const InsightList = ({ insights }: { insights: string[] }) => (
  <Card title="Insight Engine">
    <div className="pt-4 grid grid-cols-1 gap-2">
      {(insights.length ? insights : ["No specific insight available for current filters."]).map((message, index) => (
        <div
          key={`${index}-${message}`}
          className="rounded-lg border border-mainBorder bg-inputBg px-4 py-3 text-sm text-primaryText"
        >
          {message}
        </div>
      ))}
    </div>
  </Card>
);

const ModuleUnavailable = ({ title, reason }: { title: string; reason: string }) => (
  <Card title={title}>
    <div className="pt-4 text-sm text-secondaryText">{reason}</div>
  </Card>
);

const DataTable = ({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) => (
  <div className="pt-4 overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-mainBorder">
          {headers.map((header) => (
            <th key={header} className="text-left px-3 py-2 text-secondaryText font-medium whitespace-nowrap">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-mainBorder/60">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2 text-primaryText whitespace-nowrap">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const asNumber = (value: JsonValue | null | undefined) => Number(value ?? 0);
const TAB_IDS = new Set<TabKey>(TABS.map((tab) => tab.id));
const UPLOAD_TIMEOUT_MS = 120000;
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type TooltipPayloadEntry = {
  name?: string;
  value?: number | string;
  color?: string;
};

const formatMetricValue = (value: JsonValue | null | undefined) => {
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    if (Math.abs(numeric) >= 1000) {
      return compactNumber.format(numeric);
    }
    return numeric.toFixed(2);
  }
  return String(value ?? "-");
};

const truncateLabel = (value: JsonValue | null | undefined, maxLength = 14) => {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
};

const getDynamicChartHeight = (itemCount: number, base = 280, step = 12, max = 520) =>
  Math.min(max, Math.max(base, base + Math.max(0, itemCount - 8) * step));

const getTickInterval = (itemCount: number) => (itemCount > 14 ? Math.ceil(itemCount / 8) - 1 : 0);
const getLabelAngle = (itemCount: number) => (itemCount > 8 ? -30 : 0);
const getLabelHeight = (itemCount: number) => (itemCount > 8 ? 64 : 32);
const getPieRadius = (itemCount: number) => Math.max(90, Math.min(140, 80 + Math.min(itemCount, 12) * 4));

const UnifiedTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-md border border-mainBorder bg-bgColor px-3 py-2 shadow-lg">
      <div className="text-xs text-secondaryText mb-1">{label ?? "-"}</div>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div key={`${entry.name || "value"}-${index}`} className="text-xs text-primaryText flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || "#3b82f6" }} />
            <span>{entry.name || "value"}:</span>
            <span className="font-semibold">{formatMetricValue(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const buildUploadTargets = () => {
  const targets: string[] = [];
  if (typeof window !== "undefined") {
    targets.push(`${window.location.protocol}//${window.location.hostname}:8000/upload`);
  }
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    targets.push(`${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/upload`);
  }
  return Array.from(new Set(targets));
};

const uploadViaTarget = async (target: string, file: File) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(target, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.detail || json.reason || "Upload failed");
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
};

interface DynamicAnalyticsViewProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export const DynamicAnalyticsView = ({ activeTab, setActiveTab }: DynamicAnalyticsViewProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const api = useMemo(() => new ApiClient({ baseUrl: "" }), []);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState("");

  // Add error handling for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored in DynamicAnalyticsView');
        event.preventDefault();
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const activeDatasetIdRef = useRef<string>("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [analyticsStatus, setAnalyticsStatus] = useState<AnalyticsStatusResponse | null>(null);
  const lastDashboardRequestKeyRef = useRef<string>("");
  const [purchaseSortKey, setPurchaseSortKey] = useState<
    "customerId" | "totalOrders" | "lastPurchaseDate" | "avgOrderGap"
  >("totalOrders");
  const [purchaseSortDir, setPurchaseSortDir] = useState<"asc" | "desc">("desc");
  const [purchasePage, setPurchasePage] = useState(1);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    category: "",
    payment_method: "",
    granularity: "day",
  });

  useEffect(() => {
    const datasetIdFromUrl = searchParams.get("datasetId");
    if (datasetIdFromUrl) {
      setActiveDatasetId(datasetIdFromUrl);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeDatasetId", datasetIdFromUrl);
      }
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("activeDatasetId") ?? "";
      if (stored) {
        setActiveDatasetId(stored);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    activeDatasetIdRef.current = activeDatasetId;
  }, [activeDatasetId]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab || !TAB_IDS.has(tab as TabKey)) {
      return;
    }
    setActiveTab(tab as TabKey);
  }, [searchParams]);

  const refreshDatasets = useCallback(async (signal?: AbortSignal) => {
    const { data: response } = await api.get<{ status: string; data: BackendDataset[] }>("/api/datasets", {
      signal,
    });
    const normalized = (response.data || []).map((item) => ({
      datasetId: item.dataset_id || item.datasetId || "",
      createdAt: item.created_at || item.createdAt || "",
      rowCount: item.row_count || item.rowCount || 0,
      columns: typeof item.columns === "number" ? item.columns : item.columns?.length || 0,
      sourceFileName: item.source_file_name || item.sourceFileName || "",
      quality: item.quality || item.profile?.quality,
    }));
    setDatasets(normalized);
    if (!activeDatasetIdRef.current && normalized.length) {
      setActiveDatasetId(normalized[0].datasetId);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      refreshDatasets(controller.signal).catch((error) => {
        if (!controller.signal.aborted) {
          setErrorText(error instanceof Error ? error.message : "Failed to load datasets");
        }
      });
    }, 0);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [refreshDatasets]);

  const dashboardQuery = useMemo(
    () =>
      new URLSearchParams({
        from_date: filters.from,
        to_date: filters.to,
        category: filters.category,
        payment_method: filters.payment_method,
        granularity: filters.granularity,
        top: "20",
      }).toString(),
    [filters]
  );

  useEffect(() => {
    if (!activeDatasetId) {
      return;
    }

    const requestKey = `${activeDatasetId}|${dashboardQuery}`;
    if (lastDashboardRequestKeyRef.current === requestKey) {
      return;
    }
    lastDashboardRequestKeyRef.current = requestKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setIsLoading(true);
      setErrorText("");
      api
        .get<DashboardResponse>(`/api/dataset/${activeDatasetId}/dashboard?${dashboardQuery}`, {
          signal: controller.signal,
        })
        .then(({ data }) => setDashboard(data))
        .catch((error) => {
          console.error(error);
          setErrorText(normalizeErrorMessage(error));
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [activeDatasetId, dashboardQuery, api]);

  const moduleById = useMemo(
    () => new Map((dashboard?.data?.modules ?? []).map((moduleItem) => [moduleItem.id, moduleItem])),
    [dashboard]
  );
  const getModule = (id: string) => moduleById.get(id);
  const getModuleData = (id: string) => {
    const moduleItem = getModule(id);
    if (!moduleItem || moduleItem.status !== "ok") {
      return null;
    }
    return moduleItem.data ?? null;
  };
  const uploadDataset = async (file: File) => {
    const targets = buildUploadTargets();
    const apiUpload = new FormData();
    apiUpload.append("file", file);
    for (const target of targets) {
      try {
        const result = await uploadViaTarget(target, file);
        return result;
      } catch {
        continue;
      }
    }

    const { data } = await api.postForm<UploadResponse>("/api/upload", apiUpload);
    return data;
  };

  const pollAnalyticsStatus = useCallback(
    async (datasetId: string, signal?: AbortSignal) => {
      const pollEveryMs = 3000;
      const maxWaitMs = 2 * 60 * 1000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < maxWaitMs && !(signal?.aborted ?? false)) {
        const { data } = await api.get<AnalyticsStatusResponse>(
          `/api/analytics/status/${datasetId}`,
          { signal }
        );
        setAnalyticsStatus(data);
        if (data.status === "completed") {
          return data;
        }
        await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
      }
      return null;
    },
    [api]
  );
  const getModuleReason = (id: string, fallback: string) => {
    const moduleItem = getModule(id);
    if (!moduleItem) {
      return fallback;
    }
    if (moduleItem.status === "ok" && moduleItem.data) {
      return null;
    }
    return moduleItem.reason || moduleItem.errorId || "Unavailable";
  };
  const getTabUnavailableReason = (id: string, fallback: string) => {
    const reason = getModuleReason(id, fallback);
    if (!reason) {
      return null;
    }
    if (/missing/i.test(reason) && /column/i.test(reason)) {
      return "This analysis is not available (missing column)";
    }
    if (/no data for selected filters/i.test(reason)) {
      return "No data for selected filters";
    }
    return reason;
  };

  const kpis = (getModuleData("kpis") as { revenue?: number; orders?: number; quantity?: number } | null) ?? {};
  const timeSeries = ((getModuleData("time-series") as { series?: Array<{ bucket: string; value: number }> } | null)?.series ?? []);
  const categoryRows = ((getModuleData("revenue-by-category") as {
    categories?: Array<{ name: string; revenue: number; orders: number; avgOrderValue: number }>;
  } | null)?.categories ?? []);
  const paymentRows = ((getModuleData("payment-analysis") as {
    paymentMethods?: Array<{ method: string; revenue: number; orders: number }>;
    trend?: Array<{ bucket: string; method: string; orders: number; revenue: number }>;
    totals?: { totalTransactions?: number; codTransactions?: number; onlineTransactions?: number };
  } | null)?.paymentMethods ?? []);
  const paymentTrendRows = ((getModuleData("payment-analysis") as {
    trend?: Array<{ bucket: string; method: string; orders: number; revenue: number }>;
  } | null)?.trend ?? []);
  const paymentTotals = ((getModuleData("payment-analysis") as {
    totals?: { totalTransactions?: number; codTransactions?: number; onlineTransactions?: number };
  } | null)?.totals ?? {});
  const returnsRows = ((getModuleData("returns") as {
    byStatus?: Array<{ status: string; count: number; refundAmount: number }>;
    returnRateByCategory?: Array<{ category: string; returnRate: number; returned: number; total: number }>;
    refundTrend?: Array<{ bucket: string; refundAmount: number }>;
    returnOrders?: Array<{ orderId: string; category: string | null; returnStatus: string; refundAmount: number }>;
  } | null)?.byStatus ?? []);
  const returnRateByCategory = ((getModuleData("returns") as {
    returnRateByCategory?: Array<{ category: string; returnRate: number; returned: number; total: number }>;
  } | null)?.returnRateByCategory ?? []);
  const refundTrendRows = ((getModuleData("returns") as {
    refundTrend?: Array<{ bucket: string; refundAmount: number }>;
  } | null)?.refundTrend ?? []);
  const returnOrderRows = ((getModuleData("returns") as {
    returnOrders?: Array<{ orderId: string; category: string | null; returnStatus: string; refundAmount: number }>;
  } | null)?.returnOrders ?? []);
  const segmentRows = ((getModuleData("customer-segments") as {
    segments?: Array<{ segment: string; customers: number; revenue: number }>;
  } | null)?.segments ?? []);
  const customerRfmRows = ((getModuleData("customer-segments") as {
    customerRfm?: Array<{
      customerId: string;
      recencyDays: number | null;
      frequency: number;
      monetary: number;
      segment: "high_value" | "mid_value" | "low_value";
    }>;
  } | null)?.customerRfm ?? []);
  const insightsRows = ((getModuleData("insights") as {
    insights?: Array<{ message?: string }>;
  } | null)?.insights ?? []);
  const allInsights = insightsRows.map((item) => String(item.message ?? "")).filter(Boolean);
  const filterInsights = (keywords: string[]) =>
    allInsights.filter((message) =>
      keywords.some((keyword) => message.toLowerCase().includes(keyword.toLowerCase()))
    );

  const categories = dashboard?.data?.filterOptions?.category ?? [];
  const paymentMethods = dashboard?.data?.filterOptions?.paymentMethod ?? [];
  const quality = dashboard?.data?.profile?.quality;
  const anomalyRows = ((getModuleData("anomalies") as {
    anomalies?: Array<{ revenue: number; zScore: number }>;
  } | null)?.anomalies ?? [])
    .slice(0, 40)
    .map((row, index) => ({ ...row, label: `A${index + 1}` }));
  const clvFeatureRows = ((getModuleData("clv") as {
    featureImportance?: Array<{ feature: string; importance: number }>;
  } | null)?.featureImportance ?? []);
  const recommendationRows = ((getModuleData("recommendations") as {
    popular?: Array<{ productId: string; score: number }>;
  } | null)?.popular ?? []).slice(0, 20);

  const topCategory = categoryRows[0];

  const paymentByOrders = [...paymentRows].sort((a, b) => asNumber(b.orders) - asNumber(a.orders));
  const topPaymentMethod = paymentByOrders[0]?.method ?? "-";
  const codOrders = asNumber(paymentTotals.codTransactions);
  const totalPaymentOrders = asNumber(paymentTotals.totalTransactions) || paymentRows.reduce((sum, row) => sum + asNumber(row.orders), 0);
  const codShare = totalPaymentOrders ? (codOrders / totalPaymentOrders) * 100 : 0;
  const avgOrderValueByMethod =
    paymentRows.reduce((sum, row) => sum + asNumber(row.revenue), 0) / Math.max(1, totalPaymentOrders);
  const paymentTrendBuckets = Array.from(new Set(paymentTrendRows.map((row) => row.bucket)));
  const topTrendMethods = [...paymentByOrders].slice(0, 4).map((row) => row.method);
  const paymentTrendSeries = paymentTrendBuckets.map((bucket) => {
    const point: Record<string, string | number> = { bucket };
    topTrendMethods.forEach((method) => {
      point[method] = paymentTrendRows
        .filter((row) => row.bucket === bucket && row.method === method)
        .reduce((sum, row) => sum + asNumber(row.orders), 0);
    });
    return point;
  });

  const totalReturns = returnsRows.reduce((sum, row) => sum + asNumber(row.count), 0);
  const returnRate = asNumber(kpis.orders) ? (totalReturns / Math.max(1, asNumber(kpis.orders))) * 100 : 0;
  const totalRefundAmount = returnsRows.reduce((sum, row) => sum + asNumber(row.refundAmount), 0);
  const topReturnedCategory = [...returnRateByCategory].sort((a, b) => asNumber(b.returned) - asNumber(a.returned))[0];

  const totalSegmentCustomers = customerRfmRows.length;
  const highValueCustomers = customerRfmRows.filter((row) => row.segment === "high_value").length;
  const mediumValueCustomers = customerRfmRows.filter((row) => row.segment === "mid_value").length;
  const lowValueCustomers = customerRfmRows.filter((row) => row.segment === "low_value").length;

  const lowestCategory = categoryRows.length
    ? [...categoryRows].sort((a, b) => asNumber(a.revenue) - asNumber(b.revenue))[0]
    : null;
  const avgRevenuePerCategory =
    categoryRows.reduce((sum, row) => sum + asNumber(row.revenue), 0) / Math.max(1, categoryRows.length);

  const renderTab = () => {
    if (activeTab === "category-revenue") {
      return (
        <div className="grid grid-cols-1 gap-4 1xl:gap-6">
          <Card title="Executive Summary">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
              <StatCard label="Total Revenue" value={currency.format(asNumber(kpis.revenue))} />
              <StatCard label="Total Orders" value={asNumber(kpis.orders).toLocaleString()} />
              <StatCard label="Total Quantity" value={asNumber(kpis.quantity).toLocaleString()} />
              <StatCard label="Repeat Rate" value="0%" />
            </div>
          </Card>
          {getModuleReason("time-series", "Revenue trend unavailable") ? (
            <ModuleUnavailable title="Revenue Over Time" reason={getModuleReason("time-series", "Unavailable") || "Unavailable"} />
          ) : (
            <Card title="Revenue Over Time">
              <div className="pt-4" style={{ height: getDynamicChartHeight(timeSeries.length, 280, 8, 420) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="bucket"
                      interval={getTickInterval(timeSeries.length)}
                      angle={getLabelAngle(timeSeries.length)}
                      textAnchor={timeSeries.length > 8 ? "end" : "middle"}
                      height={getLabelHeight(timeSeries.length)}
                    />
                    <YAxis tickFormatter={formatMetricValue} />
                    <Tooltip content={<UnifiedTooltip />} />
                    <Area dataKey="value" stroke="#3b82f6" fill="#3b82f633" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          {getModuleReason("revenue-by-category", "Category revenue unavailable") ? (
            <ModuleUnavailable title="Category Revenue" reason={getModuleReason("revenue-by-category", "Unavailable") || "Unavailable"} />
          ) : (
            <Card title="Category Revenue Snapshot">
              <div className="pt-4" style={{ height: getDynamicChartHeight(categoryRows.length, 290, 10, 440) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(value) => truncateLabel(value, 12)}
                      interval={getTickInterval(categoryRows.length)}
                      angle={getLabelAngle(categoryRows.length)}
                      textAnchor={categoryRows.length > 8 ? "end" : "middle"}
                      height={getLabelHeight(categoryRows.length)}
                    />
                    <YAxis tickFormatter={formatMetricValue} />
                    <Tooltip content={<UnifiedTooltip />} />
                    <Bar dataKey="revenue" fill="#22d3ee" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <InsightList insights={filterInsights(["revenue", "growth", "orders"]).slice(0, 6)} />
        </div>
      );
    }

    if (activeTab === "purchase-frequency") {
      if (isLoading) {
        return (
          <div className="grid grid-cols-1 gap-4 1xl:gap-6">
            <Card title="Filter">
              <div className="pt-3 grid grid-cols-1 lg:grid-cols-5 gap-3">
                <div className="h-10 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-10 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-10 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-10 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-10 rounded-md bg-mainBorder/40 animate-pulse" />
              </div>
            </Card>
            <Card title="Purchase Frequency">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
                <StatCardSkeleton label="Avg Orders per Customer" />
                <StatCardSkeleton label="Repeat Purchase Rate (%)" />
                <StatCardSkeleton label="Active Customers" />
                <StatCardSkeleton label="Avg Purchase Interval (days)" />
              </div>
            </Card>
            <Card title="Orders Over Time">
              <ChartSkeleton height={320} />
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 1xl:gap-6">
              <Card title="Orders per Customer Distribution">
                <ChartSkeleton height={320} />
              </Card>
              <Card title="Repeat vs One-time Customers">
                <ChartSkeleton height={320} />
              </Card>
            </div>
            <Card title="Customer Table">
              <div className="pt-3 flex flex-wrap gap-2 text-sm">
                <div className="h-9 w-28 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-9 w-28 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-9 w-32 rounded-md bg-mainBorder/40 animate-pulse" />
                <div className="h-9 w-28 rounded-md bg-mainBorder/40 animate-pulse" />
              </div>
              <div className="pt-4 animate-pulse">
                <div className="h-6 w-full rounded bg-mainBorder/40 mb-2" />
                <div className="h-6 w-full rounded bg-mainBorder/40 mb-2" />
                <div className="h-6 w-full rounded bg-mainBorder/40 mb-2" />
                <div className="h-6 w-full rounded bg-mainBorder/40" />
              </div>
              <div className="pt-3 flex items-center justify-between text-sm text-secondaryText">
                <div className="h-5 w-16 rounded bg-mainBorder/40 animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-9 w-12 rounded-md bg-mainBorder/40 animate-pulse" />
                  <div className="h-9 w-12 rounded-md bg-mainBorder/40 animate-pulse" />
                </div>
              </div>
            </Card>
          </div>
        );
      }

      // Extract purchase-frequency payload from dashboard (new contract) with fallback to legacy module for compatibility
      let purchasePayload: PurchaseFrequencyDashboardPayload | null = null;

      const dashboardData = dashboard?.data;
      if (dashboardData && typeof dashboardData === "object" && "purchase_frequency" in dashboardData) {
        const maybePurchase = (dashboardData as Record<string, JsonValue>).purchase_frequency;
        if (maybePurchase && typeof maybePurchase === "object" && "status" in maybePurchase) {
          purchasePayload = maybePurchase as PurchaseFrequencyDashboardPayload;
        }
      }

      if (!purchasePayload) {
        const legacyModule = getModule("purchase-frequency");
        if (!legacyModule) {
          purchasePayload = { status: "unavailable", reason: "Purchase frequency analysis not available (missing required columns)" };
        } else if (legacyModule.status === "unavailable") {
          purchasePayload = { status: "unavailable", reason: legacyModule.reason || "Purchase frequency analysis not available (missing required columns)" };
        } else if (legacyModule.status === "error") {
          purchasePayload = { status: "error", reason: legacyModule.reason || legacyModule.errorId || "Purchase frequency error" };
        } else if (legacyModule.status === "ok" && legacyModule.data) {
          type LegacyPurchaseFrequency = {
            repeatVsNew?: { repeatCustomers?: JsonValue; newCustomers?: JsonValue };
            avgOrdersPerCustomer?: JsonValue;
            activeCustomers?: JsonValue;
            avgPurchaseInterval?: JsonValue;
            trend?: Array<{ bucket?: JsonValue; orders?: JsonValue }>;
            ordersPerUserDistribution?: Array<{ orders?: JsonValue; customers?: JsonValue }>;
            customerOrderTable?: Array<{
              customerId?: JsonValue;
              totalOrders?: JsonValue;
              lastPurchaseDate?: JsonValue;
              avgOrderGap?: JsonValue;
            }>;
          };

          const legacy = legacyModule.data as LegacyPurchaseFrequency;
          purchasePayload = {
            status: "ok",
            data: {
              avg_orders_per_customer: legacy.avgOrdersPerCustomer === null || legacy.avgOrdersPerCustomer === undefined ? undefined : asNumber(legacy.avgOrdersPerCustomer),
              repeat_rate: legacy.repeatVsNew ? (asNumber(legacy.repeatVsNew.repeatCustomers) / Math.max(1, asNumber(legacy.repeatVsNew.repeatCustomers) + asNumber(legacy.repeatVsNew.newCustomers))) * 100 : undefined,
              active_customers: legacy.activeCustomers === null || legacy.activeCustomers === undefined ? null : asNumber(legacy.activeCustomers),
              avg_purchase_interval: legacy.avgPurchaseInterval === null || legacy.avgPurchaseInterval === undefined ? null : asNumber(legacy.avgPurchaseInterval),
              orders_over_time: legacy.trend?.map((t) => ({
                date: String(t.bucket ?? ""),
                bucket: String(t.bucket ?? ""),
                orders: asNumber(t.orders),
                order_count: asNumber(t.orders),
              })),
              orders_distribution: legacy.ordersPerUserDistribution?.map((dist) => ({
                orders: asNumber(dist.orders),
                customers: asNumber(dist.customers),
              })),
              repeat_vs_onetime: legacy.repeatVsNew ? [
                { name: "Repeat", value: asNumber(legacy.repeatVsNew.repeatCustomers) },
                { name: "One-time", value: asNumber(legacy.repeatVsNew.newCustomers) },
              ] : undefined,
              customer_table: legacy.customerOrderTable?.map((c) => ({
                customer_id: String(c.customerId ?? ""),
                total_orders: asNumber(c.totalOrders),
                last_purchase_date: c.lastPurchaseDate ? String(c.lastPurchaseDate) : null,
                avg_order_gap: c.avgOrderGap === null || c.avgOrderGap === undefined ? null : asNumber(c.avgOrderGap),
              })),
            },
          };
        }
      }

      if (!purchasePayload) {
        purchasePayload = { status: "unavailable", reason: "Purchase frequency analysis not available (missing required columns)" };
      }

      if (purchasePayload.status === "unavailable") {
        return (
          <ModuleUnavailable
            title="Purchase Frequency"
            reason={purchasePayload.reason || "Purchase frequency analysis not available (missing required columns)"}
          />
        );
      }
      if (purchasePayload.status === "error") {
        return (
          <ModuleUnavailable
            title="Purchase Frequency"
            reason={purchasePayload.reason || purchasePayload.errorId || "Purchase frequency error"}
          />
        );
      }

      const d = purchasePayload.data!;
      const avgOrdersPerCustomer = d.avg_orders_per_customer ?? 0;
      const repeatRate = d.repeat_rate ?? 0;
      const activeCustomers = d.active_customers ?? null;
      const avgPurchaseInterval = d.avg_purchase_interval ?? null;

      const ordersOverTime = (d.orders_over_time ?? []).map((row) => ({
        bucket: row.date ?? row.bucket ?? "",
        orders: asNumber(row.orders ?? row.order_count),
      }));

      const ordersDistribution = (d.orders_distribution ?? []).map((row) => ({
        orders: asNumber(row.orders),
        customers: asNumber(row.customers),
      }));

      const pieData = (d.repeat_vs_onetime ?? []).map((row) => ({
        name: "name" in row ? (row.name ?? "") : ("segment" in row ? row.segment : ""),
        value: asNumber("value" in row ? row.value : ("customers" in row ? row.customers : 0)),
      }));

      const customerTableRaw = (d.customer_table ?? []).map((row) => ({
        customerId: row.customer_id ?? "",
        totalOrders: asNumber(row.total_orders),
        lastPurchaseDate: row.last_purchase_date ?? null,
        avgOrderGap: row.avg_order_gap === null || row.avg_order_gap === undefined ? null : asNumber(row.avg_order_gap),
      }));

      const sortedTableRows = [...customerTableRaw].sort((a, b) => {
        const dir = purchaseSortDir === "asc" ? 1 : -1;
        const key = purchaseSortKey;

        if (key === "customerId") {
          return dir * a.customerId.localeCompare(b.customerId);
        }
        if (key === "lastPurchaseDate") {
          return dir * String(a.lastPurchaseDate ?? "").localeCompare(String(b.lastPurchaseDate ?? ""));
        }

        const aVal = a[key] === null ? Number.NEGATIVE_INFINITY : Number(a[key]);
        const bVal = b[key] === null ? Number.NEGATIVE_INFINITY : Number(b[key]);
        return dir * (aVal - bVal);
      });

      const pageSize = 20;
      const totalPages = Math.max(1, Math.ceil(sortedTableRows.length / pageSize));
      const safePage = Math.min(Math.max(1, purchasePage), totalPages);
      const pageSlice = sortedTableRows.slice((safePage - 1) * pageSize, safePage * pageSize);

      const toggleSort = (key: "customerId" | "totalOrders" | "lastPurchaseDate" | "avgOrderGap") => {
        setPurchasePage(1);
        if (purchaseSortKey !== key) {
          setPurchaseSortKey(key);
          setPurchaseSortDir("desc");
          return;
        }
        setPurchaseSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      };

      return (
        <div className="grid grid-cols-1 gap-4 1xl:gap-6">
          <Card title="Filter">
            <div className="pt-3 grid grid-cols-1 lg:grid-cols-5 gap-3">
              <input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              />
              <input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              />
              <select
                value={filters.category}
                onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={filters.payment_method}
                onChange={(event) => setFilters((prev) => ({ ...prev, payment_method: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="">All payment methods</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <select
                value={filters.granularity}
                onChange={(event) => setFilters((prev) => ({ ...prev, granularity: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </Card>

          <Card title="Purchase Frequency">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
              <StatCard label="Avg Orders per Customer" value={avgOrdersPerCustomer.toFixed(2)} />
              <StatCard label="Repeat Purchase Rate (%)" value={`${repeatRate.toFixed(1)}%`} />
              <StatCard
                label="Active Customers"
                value={activeCustomers === null ? "-" : activeCustomers.toLocaleString()}
              />
              <StatCard
                label="Avg Purchase Interval (days)"
                value={avgPurchaseInterval === null ? "-" : avgPurchaseInterval.toFixed(1)}
              />
            </div>
          </Card>

          <Card title="Orders Over Time">
            <div className="pt-4" style={{ height: getDynamicChartHeight(ordersOverTime.length, 270, 8, 420) }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ordersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    interval={getTickInterval(ordersOverTime.length)}
                    angle={getLabelAngle(ordersOverTime.length)}
                    textAnchor={ordersOverTime.length > 8 ? "end" : "middle"}
                    height={getLabelHeight(ordersOverTime.length)}
                  />
                  <YAxis tickFormatter={formatMetricValue} />
                  <Tooltip content={<UnifiedTooltip />} />
                  <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 1xl:gap-6">
            <Card title="Orders per Customer Distribution">
              <div
                className="pt-4"
                style={{ height: getDynamicChartHeight(ordersDistribution.length, 270, 10, 420) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="orders"
                      interval={getTickInterval(ordersDistribution.length)}
                      angle={getLabelAngle(ordersDistribution.length)}
                      textAnchor={ordersDistribution.length > 8 ? "end" : "middle"}
                      height={getLabelHeight(ordersDistribution.length)}
                    />
                    <YAxis tickFormatter={formatMetricValue} />
                    <Tooltip content={<UnifiedTooltip />} />
                    <Bar dataKey="customers" fill="#8b5cf6" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Repeat vs One-time Customers">
              <div className="pt-4" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={120} isAnimationActive={false}>
                      {pieData.map((_, index) => (
                        <Cell key={`${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<UnifiedTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Customer Table">
            <div className="pt-3 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText"
                onClick={() => toggleSort("customerId")}
              >
                Sort: customer_id
              </button>
              <button
                type="button"
                className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText"
                onClick={() => toggleSort("totalOrders")}
              >
                Sort: total_orders
              </button>
              <button
                type="button"
                className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText"
                onClick={() => toggleSort("lastPurchaseDate")}
              >
                Sort: last_purchase_date
              </button>
              <button
                type="button"
                className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText"
                onClick={() => toggleSort("avgOrderGap")}
              >
                Sort: avg_order_gap
              </button>
            </div>

            <DataTable
              headers={["customer_id", "total_orders", "last_purchase_date", "avg_order_gap"]}
              rows={pageSlice.map((row) => [
                row.customerId,
                row.totalOrders,
                row.lastPurchaseDate || "-",
                row.avgOrderGap === null ? "-" : row.avgOrderGap.toFixed(1),
              ])}
            />

            <div className="pt-3 flex items-center justify-between text-sm text-secondaryText">
              <div>
                Page {safePage} / {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText disabled:opacity-50"
                  disabled={safePage <= 1}
                  onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="border border-mainBorder rounded-md px-3 py-2 bg-inputBg text-primaryText disabled:opacity-50"
                  disabled={safePage >= totalPages}
                  onClick={() => setPurchasePage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (activeTab === "category-revenue") {
      const categoryReason = getTabUnavailableReason("revenue-by-category", "Category revenue unavailable");
      if (categoryReason) {
        return <ModuleUnavailable title="Category Revenue" reason={categoryReason} />;
      }
      return (
        <div className="grid grid-cols-1 gap-4 1xl:gap-6">
          <Card title="Category Revenue Metrics">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
              <StatCard label="Total Revenue" value={currency.format(asNumber(kpis.revenue))} />
              <StatCard label="Top Category" value={topCategory?.name || "-"} />
              <StatCard label="Lowest Category" value={lowestCategory?.name || "-"} />
              <StatCard label="Avg Revenue per Category" value={currency.format(avgRevenuePerCategory)} />
            </div>
          </Card>
          <Card title="Revenue by Category">
            <div className="pt-4" style={{ height: getDynamicChartHeight(categoryRows.length, 290, 10, 440) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tickFormatter={(value) => truncateLabel(value, 12)}
                    interval={getTickInterval(categoryRows.length)}
                    angle={getLabelAngle(categoryRows.length)}
                    textAnchor={categoryRows.length > 8 ? "end" : "middle"}
                    height={getLabelHeight(categoryRows.length)}
                  />
                  <YAxis tickFormatter={formatMetricValue} />
                  <Tooltip content={<UnifiedTooltip />} />
                  <Bar dataKey="revenue" fill="#22d3ee" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Revenue Share">
            <div className="pt-4" style={{ height: getDynamicChartHeight(categoryRows.length, 280, 6, 420) }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRows} dataKey="revenue" nameKey="name" outerRadius={getPieRadius(categoryRows.length)} isAnimationActive={false}>
                    {categoryRows.map((_, index) => (
                      <Cell key={`${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<UnifiedTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          {getTabUnavailableReason("time-series", "") ? (
            <ModuleUnavailable title="Revenue Over Time" reason={getTabUnavailableReason("time-series", "Revenue trend unavailable") || "Unavailable"} />
          ) : (
            <Card title="Revenue Over Time">
              <div className="pt-4" style={{ height: getDynamicChartHeight(timeSeries.length, 280, 8, 420) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="bucket"
                      interval={getTickInterval(timeSeries.length)}
                      angle={getLabelAngle(timeSeries.length)}
                      textAnchor={timeSeries.length > 8 ? "end" : "middle"}
                      height={getLabelHeight(timeSeries.length)}
                    />
                    <YAxis tickFormatter={formatMetricValue} />
                    <Tooltip content={<UnifiedTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card title="Category Revenue Table">
            <DataTable
              headers={["Category", "Revenue", "Orders", "Avg Order Value"]}
              rows={categoryRows.map((row) => [
                row.name,
                currency.format(asNumber(row.revenue)),
                asNumber(row.orders).toLocaleString(),
                currency.format(asNumber(row.avgOrderValue)),
              ])}
            />
          </Card>
          <InsightList insights={filterInsights(["category", "revenue", "growth"]).slice(0, 6)} />
        </div>
      );
    }

    if (activeTab === "customer-segmentation") {
      const segmentationModule = dashboard?.data?.modules?.find((m: any) => m.id === "customer-segmentation");
      
      if (!segmentationModule) {
        return <ModuleUnavailable title="Customer Segmentation" reason="Customer segmentation module not available" />;
      }
      
      if (segmentationModule.status === "unavailable") {
        let reason = segmentationModule.reason || "Customer segmentation not available";
        // Improve the error message for missing columns
        if (reason.includes("Missing")) {
          if (reason.includes("customer_id") || reason.includes("revenue") || reason.includes("timestamp")) {
            reason = "Customer segmentation requires customer ID, revenue, and date columns";
          }
        }
        return <ModuleUnavailable title="Customer Segmentation" reason={reason} />;
      }
      
      if (segmentationModule.status === "error") {
        return <ModuleUnavailable title="Customer Segmentation" reason={segmentationModule.reason || "Error loading customer segmentation"} />;
      }
      
      return (
        <CustomerSegmentation
          data={segmentationModule.data as any}
          loading={isLoading}
          error={undefined}
        />
      );
    }

    if (activeTab === "payment-analysis") {
      const paymentReason = getTabUnavailableReason("payment-analysis", "Payment analysis unavailable");
      if (paymentReason) {
        return <ModuleUnavailable title="Payment Analysis" reason={paymentReason} />;
      }
      return (
        <div className="grid grid-cols-1 gap-4 1xl:gap-6">
          <Card title="Payment Method Metrics">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
              <StatCard label="Most Used Method" value={topPaymentMethod} />
              <StatCard label="Total Transactions" value={totalPaymentOrders.toLocaleString()} />
              <StatCard label="Online vs COD %" value={`${(100 - codShare).toFixed(1)}% / ${codShare.toFixed(1)}%`} />
              <StatCard label="Avg Order Value (by method)" value={currency.format(avgOrderValueByMethod)} />
            </div>
          </Card>
          <Card title="Payment Distribution">
            <div className="pt-4" style={{ height: getDynamicChartHeight(paymentRows.length, 280, 6, 420) }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentRows} dataKey="orders" nameKey="method" outerRadius={getPieRadius(paymentRows.length)} isAnimationActive={false}>
                    {paymentRows.map((_, index) => (
                      <Cell key={`${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<UnifiedTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Revenue by Payment">
            <div className="pt-4" style={{ height: getDynamicChartHeight(paymentRows.length, 290, 10, 440) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="method"
                    tickFormatter={(value) => truncateLabel(value, 12)}
                    interval={getTickInterval(paymentRows.length)}
                    angle={getLabelAngle(paymentRows.length)}
                    textAnchor={paymentRows.length > 8 ? "end" : "middle"}
                    height={getLabelHeight(paymentRows.length)}
                  />
                  <YAxis tickFormatter={formatMetricValue} />
                  <Tooltip content={<UnifiedTooltip />} />
                  <Bar dataKey="revenue" fill="#8b5cf6" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Payment Trend">
            <div className="pt-4" style={{ height: getDynamicChartHeight(paymentTrendSeries.length, 290, 8, 440) }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paymentTrendSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="bucket"
                    interval={getTickInterval(paymentTrendSeries.length)}
                    angle={getLabelAngle(paymentTrendSeries.length)}
                    textAnchor={paymentTrendSeries.length > 8 ? "end" : "middle"}
                    height={getLabelHeight(paymentTrendSeries.length)}
                  />
                  <YAxis tickFormatter={formatMetricValue} />
                  <Tooltip content={<UnifiedTooltip />} />
                  <Legend />
                  {topTrendMethods.map((method, index) => (
                    <Line
                      key={method}
                      type="monotone"
                      dataKey={method}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Payment Method Table">
            <DataTable
              headers={["Payment Method", "Transactions", "Revenue", "Avg Order Value"]}
              rows={paymentRows.map((row) => [
                row.method,
                asNumber(row.orders).toLocaleString(),
                currency.format(asNumber(row.revenue)),
                currency.format(asNumber(row.revenue) / Math.max(1, asNumber(row.orders))),
              ])}
            />
          </Card>
          <InsightList insights={filterInsights(["payment", "cod", "upi", "method"]).slice(0, 6)} />
        </div>
      );
    }

    const returnsReason = getTabUnavailableReason("returns", "Returns analysis unavailable");
    if (returnsReason) {
      return <ModuleUnavailable title="Returns & Refunds" reason={returnsReason} />;
    }
    return (
      <div className="grid grid-cols-1 gap-4 1xl:gap-6">
        <Card title="Returns & Refunds Metrics">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
            <StatCard label="Return Rate (%)" value={`${returnRate.toFixed(1)}%`} />
            <StatCard label="Total Returns" value={totalReturns.toLocaleString()} />
            <StatCard label="Refund Amount" value={currency.format(totalRefundAmount)} />
            <StatCard label="Most Returned Category" value={topReturnedCategory?.category || "-"} />
          </div>
        </Card>
        <Card title="Returns by Category">
          <div className="pt-4" style={{ height: getDynamicChartHeight(returnRateByCategory.length, 290, 10, 440) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnRateByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  tickFormatter={(value) => truncateLabel(value, 12)}
                  interval={getTickInterval(returnRateByCategory.length)}
                  angle={getLabelAngle(returnRateByCategory.length)}
                  textAnchor={returnRateByCategory.length > 8 ? "end" : "middle"}
                  height={getLabelHeight(returnRateByCategory.length)}
                />
                <YAxis tickFormatter={formatMetricValue} />
                <Tooltip content={<UnifiedTooltip />} />
                <Bar dataKey="returned" fill="#f97316" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Returns Over Time">
          <div className="pt-4" style={{ height: getDynamicChartHeight(refundTrendRows.length, 280, 8, 420) }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={refundTrendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  interval={getTickInterval(refundTrendRows.length)}
                  angle={getLabelAngle(refundTrendRows.length)}
                  textAnchor={refundTrendRows.length > 8 ? "end" : "middle"}
                  height={getLabelHeight(refundTrendRows.length)}
                />
                <YAxis tickFormatter={formatMetricValue} />
                <Tooltip content={<UnifiedTooltip />} />
                <Line type="monotone" dataKey="refundAmount" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Return Distribution">
          <div className="pt-4" style={{ height: getDynamicChartHeight(returnsRows.length, 280, 6, 420) }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={returnsRows} dataKey="count" nameKey="status" outerRadius={getPieRadius(returnsRows.length)} isAnimationActive={false}>
                  {returnsRows.map((_, index) => (
                    <Cell key={`${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<UnifiedTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Returns Table">
          <DataTable
            headers={["Order ID", "Category", "Return Status", "Refund Amount"]}
            rows={returnOrderRows.slice(0, 25).map((row) => [
              row.orderId,
              row.category || "-",
              row.returnStatus,
              currency.format(asNumber(row.refundAmount)),
            ])}
          />
        </Card>
        <InsightList insights={filterInsights(["return", "refund", "issue"]).slice(0, 6)} />
      </div>
    );
  };

  return (
    <DashboardErrorBoundary>
      <div className="w-full max-w-7xl mx-auto px-4 pb-10">
        {analyticsStatus && analyticsStatus.status !== "completed" ? (
          <div className="mt-4 rounded-lg border border-mainBorder bg-inputBg px-4 py-3 text-sm text-secondaryText">
            Analytics processing: {analyticsStatus.status}
          </div>
        ) : null}
        {activeTab !== "purchase-frequency" ? (
          <Card title="Filter Panel">
            <div className="pt-4 grid grid-cols-1 lg:grid-cols-5 gap-3">
              <input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              />
              <input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              />
              <select
                value={filters.category}
                onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={filters.payment_method}
                onChange={(event) => setFilters((prev) => ({ ...prev, payment_method: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="">All payment methods</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <select
                value={filters.granularity}
                onChange={(event) => setFilters((prev) => ({ ...prev, granularity: event.target.value }))}
                className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </Card>
        ) : null}

        {/* <Card title="Business Modules">
          <div className="pt-4 grid grid-cols-2 lg:grid-cols-6 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  }
                }}
                className={`rounded-md border px-3 py-2 text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 bg-blue-500/10 text-primaryText"
                    : "border-mainBorder bg-inputBg text-secondaryText"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card> */}

        {errorText ? (
          <Card title="Error">
            <div className="pt-4 text-sm text-red-400">{errorText}</div>
          </Card>
        ) : null}

        {!activeDatasetId ? (
          <Card title="Dataset">
            <div className="pt-4 text-sm text-secondaryText">
              Select or upload a dataset on the Data page to view analytics.
            </div>
          </Card>
        ) : isLoading ? (
          <Card title="Loading">
            <div className="pt-4 text-sm text-secondaryText">Fetching analytics...</div>
          </Card>
        ) : (
          renderTab()
        )}
      </div>
    </DashboardErrorBoundary>
  );
};
