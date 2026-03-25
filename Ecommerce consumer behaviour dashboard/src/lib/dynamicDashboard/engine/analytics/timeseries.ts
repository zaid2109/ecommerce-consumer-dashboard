import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  hasUsableRows: (dataset: DatasetMetadata, whereSql: string, params: Array<string | number | boolean>) => Promise<number>;
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getTimeSeries = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  granularity: "day" | "week" | "month",
  deps: Deps
): Promise<ModuleResult<{ series: Array<{ bucket: string; value: number }>; timezone: string }>> => {
  const timestampCol = dataset.roles.timestamp?.column;
  const revenueCol = dataset.roles.revenue?.column;
  if (!timestampCol || !revenueCol) {
    return deps.unavailable("Missing timestamp or revenue column", ["timestamp", "revenue"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const rowCount = await deps.hasUsableRows(dataset, filter.whereSql, filter.params);
  if (rowCount === 0) {
    return deps.unavailable("No data for selected filters", ["timestamp", "revenue"], dataset);
  }
  const series = await deps.withQueryTiming("time_series", () =>
    deps.all<{ bucket: string; value: number }>(
      `
      select
        strftime(date_trunc('${granularity}', ${deps.toIdentifier(timestampCol)}), '%Y-%m-%d') as bucket,
        coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as value
      from ${deps.toIdentifier(dataset.tables.clean)}
      ${filter.whereSql}
      group by 1
      order by 1
    `,
      filter.params
    )
  );
  if (!series.length) {
    return deps.unavailable("No data for selected filters", ["timestamp", "revenue"], dataset);
  }
  return {
    status: "ok",
    data: {
      series: series.map((point) => ({
        bucket: point.bucket,
        value: Number(point.value),
      })),
      timezone: "UTC",
    },
    meta: {
      unappliedFilters: filter.unapplied,
    },
  };
};
