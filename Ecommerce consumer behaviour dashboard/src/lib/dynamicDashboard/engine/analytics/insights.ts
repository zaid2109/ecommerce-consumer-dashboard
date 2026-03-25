import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
  truthyStatusExpression: (columnName: string) => string;
};

export const getInsights = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<ModuleResult<{ insights: Array<{ level: "info" | "warning" | "success"; message: string }> }>> => {
  const revenueCol = dataset.roles.revenue?.column;
  if (!revenueCol) {
    return deps.unavailable("Missing revenue column", ["revenue"], dataset);
  }
  const timestampCol = dataset.roles.timestamp?.column;
  const categoryCol = dataset.roles.category?.column;
  const returnStatusCol = dataset.roles.return_status?.column;
  const filter = deps.buildFilterClause(dataset, filters);
  const insights: Array<{ level: "info" | "warning" | "success"; message: string }> = [];
  if (timestampCol) {
    const rows = await deps.withQueryTiming("insights_sales_trend", () =>
      deps.all<{ period: string; revenue: number }>(
        `
          select
            case
              when ${deps.toIdentifier(timestampCol)} >= now() - interval 7 day then 'last_7'
              when ${deps.toIdentifier(timestampCol)} >= now() - interval 14 day then 'prev_7'
              else 'older'
            end as period,
            coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          group by 1
        `,
        filter.params
      )
    );
    const last7 = Number(rows.find((row) => row.period === "last_7")?.revenue ?? 0);
    const prev7 = Number(rows.find((row) => row.period === "prev_7")?.revenue ?? 0);
    if (prev7 > 0 && last7 < prev7 * 0.85) {
      insights.push({
        level: "warning",
        message: `Sales dropped by ${(((prev7 - last7) / prev7) * 100).toFixed(1)}% in last 7 days`,
      });
    } else if (prev7 > 0 && last7 > prev7 * 1.1) {
      insights.push({
        level: "success",
        message: `Sales increased by ${(((last7 - prev7) / prev7) * 100).toFixed(1)}% in last 7 days`,
      });
    }
  }
  if (categoryCol) {
    const best = await deps.withQueryTiming("insights_best_category", () =>
      deps.all<{ category: string; revenue: number }>(
        `
          select
            cast(${deps.toIdentifier(categoryCol)} as varchar) as category,
            coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          group by 1
          order by 2 desc
          limit 1
        `,
        filter.params
      )
    );
    if (best.length) {
      insights.push({
        level: "success",
        message: `${best[0].category} is the top-performing category`,
      });
    }
  }
  if (returnStatusCol && categoryCol) {
    const returnedFlag = deps.truthyStatusExpression(returnStatusCol);
    const highestReturn = await deps.withQueryTiming("insights_high_returns", () =>
      deps.all<{ category: string; return_rate: number }>(
        `
          select
            cast(${deps.toIdentifier(categoryCol)} as varchar) as category,
            sum(${returnedFlag}) * 1.0 / greatest(1, count(*)) as return_rate
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          group by 1
          order by 2 desc
          limit 1
        `,
        filter.params
      )
    );
    if (highestReturn.length && Number(highestReturn[0].return_rate) > 0.12) {
      insights.push({
        level: "warning",
        message: `${highestReturn[0].category} has the highest return rate`,
      });
    }
  }
  if (!insights.length) {
    insights.push({
      level: "info",
      message: "No major anomalies detected in selected range",
    });
  }
  return {
    status: "ok",
    data: { insights },
    meta: {
      unappliedFilters: filter.unapplied,
      timestampFallback: !timestampCol,
      categoryFallback: !categoryCol,
      returnFallback: !returnStatusCol,
    },
  };
};
