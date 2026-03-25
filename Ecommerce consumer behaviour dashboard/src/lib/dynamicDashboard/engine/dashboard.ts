import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../types/engine";
import { getKpis } from "./analytics/kpi";
import { getTimeSeries } from "./analytics/timeseries";
import { getRevenueByCategory } from "./analytics/revenueByCategory";
import { getPaymentAnalysis } from "./analytics/paymentAnalysis";
import { getReturns } from "./analytics/returns";
import { getAnomalies } from "./analytics/anomaly";
import { getClv } from "./analytics/clv";
import { getRecommendations } from "./analytics/recommendations";
import { getInsights } from "./analytics/insights";
import { getCustomerSegments } from "./analytics/segmentation";
import { getPurchaseFrequency } from "./analytics/purchaseFrequency";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
  truthyStatusExpression: (columnName: string) => string;
  falsyStatusExpression: (columnName: string) => string;
  hasUsableRows: (dataset: DatasetMetadata, whereSql: string, params: Array<string | number | boolean>) => Promise<number>;
};

export const buildDashboard = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  granularity: "day" | "week" | "month",
  topN: number,
  deps: Deps
) => {
  const kpis = await getKpis(dataset, filters, deps);
  const timeSeries = await getTimeSeries(dataset, filters, granularity, deps);
  const byCategory = await getRevenueByCategory(dataset, filters, topN, deps);
  const purchaseFrequency = await getPurchaseFrequency(dataset, filters, deps);
  const paymentAnalysis = await getPaymentAnalysis(dataset, filters, deps);
  const returns = await getReturns(dataset, filters, deps);
  const customerSegments = await getCustomerSegments(dataset, filters, deps);
  const anomalies = await getAnomalies(dataset, filters, deps);
  const clv = await getClv(dataset, filters, deps);
  const recommendations = await getRecommendations(dataset, filters, deps);
  const insights = await getInsights(dataset, filters, deps);

  return {
    kpis,
    timeSeries,
    byCategory,
    purchaseFrequency,
    paymentAnalysis,
    returns,
    customerSegments,
    anomalies,
    clv,
    recommendations,
    insights,
  };
};
