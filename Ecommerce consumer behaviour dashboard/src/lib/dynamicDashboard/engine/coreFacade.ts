import duckdb from "duckdb";

import type {
  BuildDashboardResult,
  DashboardModule,
  DashboardResponse,
  DatasetMetadata,
  FilterInput,
} from "../../../types/engine";
import { NextResponse } from "next/server";

import { runUploadPipeline, runDashboardPipeline } from "./pipelineManager";
import {
  getAnomalies,
  getClv,
  getCustomerSegments,
  getInsights,
  getKpis,
  getPaymentAnalysis,
  getPurchaseFrequency,
  getRecommendations,
  getReturns,
  getRevenueByCategory,
  getTimeSeries,
  setAnalyticsDeps,
} from "./analytics";
import { getAutoVisualModules } from "./autoVisual";
import {
  all,
  hasUsableRows,
  truthyStatusExpression,
  falsyStatusExpression,
  withQueryTiming,
  run,
} from "./db";
import { buildQuality, buildNormalizationArtifacts } from "./profiling";
import { buildFilterClause as buildFilterClauseEngine } from "./queryBuilder";
import { inferRoles, buildModuleAvailability } from "./roleInference";
import { columnStats, getColumnNames } from "./schema";
import { createCleanTable, normalizeMoneyExpr, parseTimestampExpr, normalizeBooleanExpr } from "./normalization";
import {
  deleteDataset as deleteDatasetFromStore,
  getDataset,
  listDatasets,
  setDatasetStoreDeps,
} from "./datasetStore";
import { getTablePage, getUniqueValues } from "./table";
import { clamp, randomId, ratio, toIdentifier, toSqlString } from "./utils";

import fs from "fs";
import path from "path";

const TOP_N_DEFAULT = 20;
const MAX_FILE_SIZE_MB = 100;
const MAX_COLUMNS = 200;
const MAX_FIELD_LENGTH = 10000;
const DATA_ROOT = path.join(process.cwd(), ".data", "dynamic_dashboard");
const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
const META_FILE = path.join(DATA_ROOT, "datasets.json");
const DB_FILE = path.join(DATA_ROOT, "analytics.duckdb");
const DEBUG = process.env.DEBUG === "true";

const ensureStorage = () => {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(META_FILE)) {
    fs.writeFileSync(META_FILE, "{}", "utf-8");
  }
};

const cache = new Map<string, DashboardResponse>();

const clearDatasetCache = (datasetId: string) => {
  Array.from(cache.keys()).forEach((key) => {
    if (key.includes(datasetId)) {
      cache.delete(key);
    }
  });
};

// Initialize dependency injection
setAnalyticsDeps({
  buildFilterClause: (dataset, filters) => buildFilterClauseEngine(dataset, filters, { toIdentifier }),
  hasUsableRows: async (dataset, whereSql, params) =>
    hasUsableRows(
      { ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier },
      dataset,
      whereSql,
      params
    ),
  toIdentifier,
  withQueryTiming,
  all: <T>(sql: string, params?: Array<string | number | boolean>) =>
    all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
  unavailable: (reason, required, dataset) => ({
    status: "unavailable",
    reason,
    required,
    detected: Object.fromEntries(
      Object.entries(dataset.roles).map(([key, role]) => [key, role?.column ?? null])
    ),
  }),
  truthyStatusExpression,
  falsyStatusExpression,
});

setDatasetStoreDeps({
  ensureStorage,
  metaFilePath: META_FILE,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
  existsSync: fs.existsSync,
  unlinkSync: fs.unlinkSync,
  clearDatasetCache,
  inferRoles: (schema) =>
    inferRoles(schema, { clamp, threshold: Number(process.env.ROLE_CONFIDENCE_THRESHOLD ?? 0.6) }),
  buildModuleAvailability,
});

const unavailable = (reason: string, required: string[], dataset: DatasetMetadata): BuildDashboardResult => ({
  status: "ok",
  data: {
    datasetId: dataset.datasetId,
    schema: dataset.schema,
    profile: dataset.profile,
    roles: dataset.roles,
    timestampNormalization: "UTC",
    timestampSourceTimezone: dataset.timestampSourceTimezone,
    filterOptions: {
      category: [],
      paymentMethod: [],
    },
    modules: [
      {
        id: "error",
        title: "Error",
        status: "unavailable",
        reason,
        required,
        detected: Object.fromEntries(
          Object.entries(dataset.roles).map(([key, role]) => [key, role?.column ?? null])
        ),
      },
    ],
  },
});

const moduleUnavailable = (reason: string, required: string[], dataset: DatasetMetadata) => ({
  status: "unavailable" as const,
  reason,
  required,
  detected: Object.fromEntries(
    Object.entries(dataset.roles).map(([key, role]) => [key, role?.column ?? null])
  ),
});

const buildDashboard = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  granularity: "day" | "week" | "month",
  topN: number
): Promise<BuildDashboardResult> => {
  const cacheKey = JSON.stringify({
    datasetId: dataset.datasetId,
    endpoint: "dashboard",
    filters,
    granularity,
    topN,
  });
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  if (dataset.rowCount < 2) {
    const result = unavailable("Dataset contains insufficient data", [], dataset);
    cache.set(cacheKey, result);
    return result;
  }
  const pipeline = await runDashboardPipeline(
    dataset,
    filters,
    [
      { id: "kpis", title: "KPIs", enabled: true },
      { id: "time-series", title: "Revenue Over Time", enabled: true },
      { id: "revenue-by-category", title: "Revenue By Category", enabled: true },
      { id: "purchase-frequency", title: "Purchase Frequency", enabled: true },
      { id: "payment-analysis", title: "Payment Analysis", enabled: true },
      { id: "returns", title: "Returns", enabled: true },
      { id: "customer-segments", title: "Customer Segments", enabled: true },
      { id: "anomalies", title: "Anomalies", enabled: true },
      { id: "clv", title: "Customer Lifetime Value", enabled: true },
      { id: "recommendations", title: "Recommendations", enabled: true },
      { id: "insights", title: "AI Insights", enabled: true },
    ],
    { granularity, topN },
    {
      buildFilterClause: (d, f) => buildFilterClauseEngine(d, f, { toIdentifier }),
      toIdentifier,
      withQueryTiming,
      all: <T>(sql: string, params?: Array<string | number | boolean>) =>
        all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
      unavailable: (reason, required, d) => moduleUnavailable(reason, required, d),
      truthyStatusExpression,
      falsyStatusExpression,
      hasUsableRows: async (d, whereSql, params) =>
        hasUsableRows(
          { ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier },
          d,
          whereSql,
          params
        ),
    }
  );
  const categoryOptions = await getUniqueValues(dataset, "category", {
    toIdentifier,
    all: <T>(sql: string, params?: Array<string | number | boolean>) =>
      all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
  });
  const paymentMethodOptions = await getUniqueValues(dataset, "payment_method", {
    toIdentifier,
    all: <T>(sql: string, params?: Array<string | number | boolean>) =>
      all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
  });
  const autoVisualModules = await getAutoVisualModules(dataset, filters, {
    toIdentifier,
    withQueryTiming,
    all: <T>(sql: string, params?: Array<string | number | boolean>) =>
      all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
    buildFilterClause: (d, f) => buildFilterClauseEngine(d, f, { toIdentifier }),
  });
  const response: DashboardResponse = {
    status: "ok",
    data: {
      datasetId: dataset.datasetId,
      schema: dataset.schema,
      profile: dataset.profile,
      roles: dataset.roles,
      timestampNormalization: "UTC",
      timestampSourceTimezone: dataset.timestampSourceTimezone,
      filterOptions: {
        category: categoryOptions,
        paymentMethod: paymentMethodOptions,
      },
      modules: [...(pipeline.resolvedModules as Array<DashboardModule>), ...autoVisualModules],
    },
  };
  cache.set(cacheKey, response);
  return response;
};

export const uploadDataset = async (file: File) => {
  const deps = {
    ensureStorage,
    randomId,
    uploadsDir: UPLOADS_DIR,
    maxFileSizeMb: MAX_FILE_SIZE_MB,
    maxColumns: MAX_COLUMNS,
    maxFieldLength: MAX_FIELD_LENGTH,
    run: (sql: string, params?: Array<string | number | boolean>) =>
      run({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
    all: <T = unknown>(sql: string, params?: Array<string | number | boolean>) =>
      all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
    toIdentifier,
    toSqlString,
    getColumnNames: async (tableName: string) =>
      getColumnNames(tableName, {
        toSqlString,
        all: <T = unknown>(sql: string) =>
          all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql),
      }),
    pathExtname: path.extname,
    pathJoin: path.join,
    writeFileSync: fs.writeFileSync,
    columnStats: (rawTable: string, columnName: string) =>
      columnStats(rawTable, columnName, {
        all: <T = unknown>(sql: string) =>
          all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql),
        toIdentifier,
        ratio,
        normalizeMoneyExpr,
        parseTimestampExpr,
        normalizeBooleanExpr,
      }),
    createCleanTable: (cleanTable: string, rawTable: string, columns: Parameters<typeof createCleanTable>[2]) =>
      createCleanTable(cleanTable, rawTable, columns, {
        toIdentifier,
        run: (sql: string) => run({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql),
      }),
    inferRoles: (columns: Parameters<typeof inferRoles>[0]) =>
      inferRoles(columns, { clamp, threshold: Number(process.env.ROLE_CONFIDENCE_THRESHOLD ?? 0.6) }),
    buildNormalizationArtifacts,
    buildQuality: (columns: Parameters<typeof buildQuality>[0], roles: Parameters<typeof buildQuality>[1]) =>
      buildQuality(columns, roles, { clamp, ratio }),
    nowIso: () => new Date().toISOString(),
    buildModuleAvailability,
    persistMetadata: () => undefined,
    loadMetadata: () => ({}),
    clearDatasetCache,
  };

  return runUploadPipeline(file, deps);
};

export const parseFilters = (searchParams: URLSearchParams): FilterInput => ({
  from: searchParams.get("from"),
  to: searchParams.get("to"),
  category: searchParams.get("category"),
  paymentMethod: searchParams.get("payment_method"),
});

export const parseGranularity = (value: string | null): "day" | "week" | "month" => {
  if (value === "week" || value === "month") {
    return value;
  }
  return "day";
};

export const parseTopN = (value: string | null) => {
  const parsed = Number(value ?? TOP_N_DEFAULT);
  if (Number.isNaN(parsed)) {
    return TOP_N_DEFAULT;
  }
  return Math.max(1, Math.min(parsed, 100));
};

export const parsePagination = (searchParams: URLSearchParams) => {
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 30);
  return {
    page: Number.isNaN(page) ? 1 : page,
    limit: Number.isNaN(limit) ? 30 : limit,
  };
};

export const withApiHandler = async (
  request: Request,
  datasetId: string | undefined,
  handler: () => Promise<NextResponse>
) => {
  const requestId = randomId("req");
  const startedAt = Date.now();
  try {
    const response = await handler();
    requestLog({
      method: request.method,
      pathName: new URL(request.url).pathname,
      status: response.status,
      startedAt,
      requestId,
      datasetId,
    });
    return response;
  } catch (error) {
    const status = error instanceof Error && error.message.includes("not found") ? 404 : 500;
    requestLog({
      method: request.method,
      pathName: new URL(request.url).pathname,
      status,
      startedAt,
      requestId,
      datasetId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { status: "error", reason: error instanceof Error ? error.message : "Unknown error" },
      { status }
    );
  }
};

const requestLog = (log: {
  method: string;
  pathName: string;
  status: number;
  startedAt: number;
  requestId: string;
  datasetId?: string;
  error?: string;
}) => {
  if (DEBUG) {
    console.log(
      JSON.stringify({
        ...log,
        durationMs: Date.now() - log.startedAt,
      })
    );
  }
};

// Endpoint functions
export const getKpisEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getKpis(dataset, filters);
};

export const getTimeSeriesEndpoint = async (
  datasetId: string,
  filters: FilterInput,
  granularity: "day" | "week" | "month"
) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getTimeSeries(dataset, filters, granularity);
};

export const getRevenueByCategoryEndpoint = async (datasetId: string, filters: FilterInput, topN: number) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getRevenueByCategory(dataset, filters, topN);
};

export const getPaymentAnalysisEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getPaymentAnalysis(dataset, filters);
};

export const getReturnsEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getReturns(dataset, filters);
};

export const getCustomerSegmentsEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getCustomerSegments(dataset, filters);
};

export const getPurchaseFrequencyEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getPurchaseFrequency(dataset, filters);
};

export const getAnomaliesEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getAnomalies(dataset, filters);
};

export const getClvEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getClv(dataset, filters);
};

export const getRecommendationsEndpoint = async (datasetId: string, filters: FilterInput) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getRecommendations(dataset, filters);
};

export const getTableEndpoint = async (
  datasetId: string,
  filters: FilterInput,
  page: number,
  limit: number
) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return getTablePage(dataset, page, limit, filters, {
    toIdentifier,
    all: <T>(sql: string, params?: Array<string | number | boolean>) =>
      all<T>({ ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier }, sql, params ?? []),
    buildFilterClause: (d, f) => buildFilterClauseEngine(d, f, { toIdentifier }),
  });
};

export const getDashboardEndpoint = async (
  datasetId: string,
  filters: FilterInput,
  granularity: "day" | "week" | "month",
  topN: number
) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  return buildDashboard(dataset, filters, granularity, topN);
};

export const getExportEndpoint = async (datasetId: string) => {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error("Dataset not found");
  const rows = await all(
    { ensureStorage, dbFilePath: DB_FILE, duckdbModule: duckdb, toIdentifier },
    `select * from ${toIdentifier(dataset.tables.clean)} order by 1 limit 10000`
  );
  return rows;
};

export { listDatasets };

export const getSchema = (datasetId: string) => {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    return null;
  }
  return {
    status: "ok" as const,
    data: {
      datasetId,
      columns: dataset.schema,
      roles: dataset.roles,
      quality: dataset.profile.quality,
    },
  };
};

export const getProfile = (datasetId: string) => {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    return null;
  }
  return {
    status: "ok" as const,
    data: {
      datasetId,
      profile: dataset.profile,
    },
  };
};

export const getModules = (datasetId: string) => {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    return null;
  }
  return {
    status: "ok" as const,
    data: {
      datasetId,
      modules: dataset.modules,
    },
  };
};

export const deleteDataset = async (datasetId: string) => {
  return deleteDatasetFromStore(datasetId);
};
