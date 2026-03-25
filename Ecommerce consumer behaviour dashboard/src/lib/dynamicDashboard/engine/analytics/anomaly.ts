import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getAnomalies = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    summary: {
      totalRows: number;
      anomalyCount: number;
      anomalyRate: number;
      threshold: { q1: number; q3: number; iqrUpper: number };
    };
    anomalies: Array<{
      rowId: number;
      revenue: number;
      zScore: number | null;
      bucket: string | null;
      customerId: string | null;
      productId: string | null;
      category: string | null;
    }>;
  }>
> => {
  const revenueCol = dataset.roles.revenue?.column;
  if (!revenueCol) {
    return deps.unavailable("Missing revenue column", ["revenue"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const timestampCol = dataset.roles.timestamp?.column;
  const customerCol = dataset.roles.customer_id?.column;
  const productCol = dataset.roles.product_id?.column;
  const categoryCol = dataset.roles.category?.column;
  const baseWhere = filter.whereSql
    ? `${filter.whereSql} and ${deps.toIdentifier(revenueCol)} is not null`
    : `where ${deps.toIdentifier(revenueCol)} is not null`;
  const [summary] = await deps.withQueryTiming("anomalies_summary", () =>
    deps.all<{
      total_rows: number;
      anomaly_count: number;
      q1: number;
      q3: number;
      iqr_upper: number;
    }>(
      `
        with base as (
          select ${deps.toIdentifier(revenueCol)} as revenue
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${baseWhere}
        ),
        stats as (
          select
            quantile_cont(revenue, 0.25) as q1,
            quantile_cont(revenue, 0.75) as q3
          from base
        )
        select
          count(*) as total_rows,
          sum(case when revenue > (stats.q3 + 1.5 * (stats.q3 - stats.q1)) then 1 else 0 end) as anomaly_count,
          coalesce(stats.q1, 0) as q1,
          coalesce(stats.q3, 0) as q3,
          coalesce(stats.q3 + 1.5 * (stats.q3 - stats.q1), 0) as iqr_upper
        from base, stats
      `,
      filter.params
    )
  );
  const totalRows = Number(summary?.total_rows ?? 0);
  if (totalRows === 0) {
    return deps.unavailable("No data for selected filters", ["revenue"], dataset);
  }
  const anomalies = await deps.withQueryTiming("anomalies_rows", () =>
    deps.all<{
      row_id: number;
      revenue: number;
      z_score: number | null;
      bucket: string | null;
      customer_id: string | null;
      product_id: string | null;
      category: string | null;
    }>(
      `
        with base as (
          select
            row_number() over () as row_id,
            ${deps.toIdentifier(revenueCol)} as revenue,
            ${timestampCol ? `strftime(date_trunc('day', ${deps.toIdentifier(timestampCol)}), '%Y-%m-%d')` : "null"} as bucket,
            ${customerCol ? `cast(${deps.toIdentifier(customerCol)} as varchar)` : "null"} as customer_id,
            ${productCol ? `cast(${deps.toIdentifier(productCol)} as varchar)` : "null"} as product_id,
            ${categoryCol ? `cast(${deps.toIdentifier(categoryCol)} as varchar)` : "null"} as category
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${baseWhere}
        ),
        stats as (
          select
            quantile_cont(revenue, 0.25) as q1,
            quantile_cont(revenue, 0.75) as q3,
            avg(revenue) as mean,
            stddev(revenue) as sd
          from base
        )
        select
          row_id,
          revenue,
          case when stats.sd > 0 then (revenue - stats.mean) / stats.sd else null end as z_score,
          bucket,
          customer_id,
          product_id,
          category
        from base, stats
        where revenue > (stats.q3 + 1.5 * (stats.q3 - stats.q1))
        order by revenue desc
        limit 100
      `,
      filter.params
    )
  );
  const anomalyCount = Number(summary?.anomaly_count ?? 0);
  return {
    status: "ok",
    data: {
      summary: {
        totalRows,
        anomalyCount,
        anomalyRate: anomalyCount / Math.max(1, totalRows),
        threshold: {
          q1: Number(summary?.q1 ?? 0),
          q3: Number(summary?.q3 ?? 0),
          iqrUpper: Number(summary?.iqr_upper ?? 0),
        },
      },
      anomalies: anomalies.map((row) => ({
        rowId: Number(row.row_id),
        revenue: Number(row.revenue),
        zScore: row.z_score !== null ? Number(row.z_score) : null,
        bucket: row.bucket,
        customerId: row.customer_id,
        productId: row.product_id,
        category: row.category,
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      timestampFallback: !timestampCol,
      customerFallback: !customerCol,
      productFallback: !productCol,
      categoryFallback: !categoryCol,
    },
  };
};
