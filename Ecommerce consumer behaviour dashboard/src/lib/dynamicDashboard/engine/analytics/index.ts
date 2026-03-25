import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";
import { getKpis as engineGetKpis } from "./kpi";
import { getTimeSeries as engineGetTimeSeries } from "./timeseries";
import { getRevenueByCategory as engineGetRevenueByCategory } from "./revenueByCategory";
import { getPaymentAnalysis as engineGetPaymentAnalysis } from "./paymentAnalysis";
import { getReturns as engineGetReturns } from "./returns";
import { getAnomalies as engineGetAnomalies } from "./anomaly";
import { getClv as engineGetClv } from "./clv";
import { getRecommendations as engineGetRecommendations } from "./recommendations";
import { getInsights as engineGetInsights } from "./insights";
import { getCustomerSegments as engineGetCustomerSegments } from "./segmentation";
import { getPurchaseFrequency as engineGetPurchaseFrequency } from "./purchaseFrequency";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  hasUsableRows: (dataset: DatasetMetadata, whereSql: string, params: Array<string | number | boolean>) => Promise<number>;
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
  truthyStatusExpression: (columnName: string) => string;
  falsyStatusExpression: (columnName: string) => string;
};

let deps: Deps;

export const setAnalyticsDeps = (newDeps: Deps) => {
  deps = newDeps;
};

export const getKpis = async (dataset: DatasetMetadata, filters: FilterInput): Promise<ModuleResult<Record<string, number>>> => {
  return engineGetKpis(dataset, filters, deps);
};

export const getTimeSeries = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  granularity: "day" | "week" | "month"
): Promise<ModuleResult<{ series: Array<{ bucket: string; value: number }>; timezone: string }>> => {
  return engineGetTimeSeries(dataset, filters, granularity, deps);
};

export const getRevenueByCategory = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  topN: number
): Promise<ModuleResult<{ categories: Array<{ name: string; revenue: number; orders: number; avgOrderValue: number }> }>> => {
  return engineGetRevenueByCategory(dataset, filters, topN, deps);
};

export const getPaymentAnalysis = async (dataset: DatasetMetadata, filters: FilterInput) =>
  engineGetPaymentAnalysis(dataset, filters, deps);

export const getReturns = async (dataset: DatasetMetadata, filters: FilterInput) =>
  engineGetReturns(dataset, filters, deps);

export const getCustomerSegments = async (dataset: DatasetMetadata, filters: FilterInput) =>
  engineGetCustomerSegments(dataset, filters, deps);

export const getPurchaseFrequency = async (dataset: DatasetMetadata, filters: FilterInput) =>
  engineGetPurchaseFrequency(dataset, filters, deps);

export const getAnomalies = async (dataset: DatasetMetadata, filters: FilterInput) =>
  engineGetAnomalies(dataset, filters, deps);

export const getClv = async (
  dataset: DatasetMetadata,
  filters: FilterInput
): Promise<
  ModuleResult<{
    model: string;
    strategy: "adaptive_regression_like";
    features: string[];
    featureImportance: Array<{ feature: string; importance: number }>;
    customers: Array<{
      customerId: string;
      recencyDays: number | null;
      frequency: number;
      monetary: number;
      predictedClv: number;
      segment: "high_value" | "mid_value" | "low_value";
    }>;
  }>
> => {
  return engineGetClv(dataset, filters, deps);
};

export const getRecommendations = async (
  dataset: DatasetMetadata,
  filters: FilterInput
): Promise<
  ModuleResult<{
    strategy: "collaborative" | "popularity";
    recommendations: Array<{
      customerId: string;
      items: Array<{ productId: string; score: number }>;
    }>;
    popular: Array<{ productId: string; score: number }>;
  }>
> => {
  return engineGetRecommendations(dataset, filters, deps);
};

export const getInsights = async (
  dataset: DatasetMetadata,
  filters: FilterInput
): Promise<
  ModuleResult<{
    insights: Array<{ level: "info" | "warning" | "success"; message: string }>;
  }>
> => {
  return engineGetInsights(dataset, filters, deps);
};
