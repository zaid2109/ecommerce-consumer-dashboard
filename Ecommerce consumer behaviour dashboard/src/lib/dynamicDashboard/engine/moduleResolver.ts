import type { DatasetMetadata, FilterInput, ModuleConfig, ModuleResult } from "../../../types/engine";
import { getAnomalies } from "./analytics/anomaly";
import { getClv } from "./analytics/clv";
import { getInsights } from "./analytics/insights";
import { getKpis } from "./analytics/kpi";
import { getPaymentAnalysis } from "./analytics/paymentAnalysis";
import { getPurchaseFrequency } from "./analytics/purchaseFrequency";
import { getRecommendations } from "./analytics/recommendations";
import { getReturns } from "./analytics/returns";
import { getRevenueByCategory } from "./analytics/revenueByCategory";
import { getCustomerSegments } from "./analytics/segmentation";
import { getTimeSeries } from "./analytics/timeseries";

export type DashboardModuleId =
  | "kpis"
  | "time-series"
  | "revenue-by-category"
  | "purchase-frequency"
  | "payment-analysis"
  | "returns"
  | "customer-segments"
  | "anomalies"
  | "clv"
  | "recommendations"
  | "insights";

export type ResolveContext = {
  granularity: "day" | "week" | "month";
  topN: number;
};

export type ResolverDeps = {
  buildFilterClause: (
    dataset: DatasetMetadata,
    filters: FilterInput
  ) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[] };
  hasUsableRows: (
    dataset: DatasetMetadata,
    whereSql: string,
    params: Array<string | number | boolean>
  ) => Promise<number>;
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (
    reason: string,
    required: string[],
    dataset: DatasetMetadata
  ) => {
    status: "unavailable";
    reason: string;
    required: string[];
    detected: Record<string, string | null>;
  };
  truthyStatusExpression: (columnName: string) => string;
  falsyStatusExpression: (columnName: string) => string;
};

export const resolveModule = async (
  moduleId: DashboardModuleId,
  dataset: DatasetMetadata,
  filters: FilterInput,
  context: ResolveContext,
  deps: ResolverDeps
): Promise<ModuleResult<unknown>> => {
  switch (moduleId) {
    case "kpis":
      return getKpis(dataset, filters, deps);
    case "time-series":
      return getTimeSeries(dataset, filters, context.granularity, deps);
    case "revenue-by-category":
      return getRevenueByCategory(dataset, filters, context.topN, deps);
    case "purchase-frequency":
      return getPurchaseFrequency(dataset, filters, deps);
    case "payment-analysis":
      return getPaymentAnalysis(dataset, filters, deps);
    case "returns":
      return getReturns(dataset, filters, deps);
    case "customer-segments":
      return getCustomerSegments(dataset, filters, deps);
    case "anomalies":
      return getAnomalies(dataset, filters, deps);
    case "clv":
      return getClv(dataset, filters, deps);
    case "recommendations":
      return getRecommendations(dataset, filters, deps);
    case "insights":
      return getInsights(dataset, filters, deps);
  }
};

export const resolveModules = async (
  modules: ModuleConfig[],
  dataset: DatasetMetadata,
  filters: FilterInput,
  context: ResolveContext,
  deps: ResolverDeps
): Promise<Array<{ id: string; title: string } & ModuleResult<unknown>>> => {
  const enabled = modules.filter((module) => module.enabled);
  const results: Array<{ id: string; title: string } & ModuleResult<unknown>> = [];
  for (const module of enabled) {
    const moduleId = module.id as DashboardModuleId;
    const result = await resolveModule(moduleId, dataset, filters, context, deps);
    results.push({ id: module.id, title: module.title, ...result });
  }
  return results;
};
