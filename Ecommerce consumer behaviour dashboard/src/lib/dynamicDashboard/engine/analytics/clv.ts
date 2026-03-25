import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getClv = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
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
  const customerCol = dataset.roles.customer_id?.column;
  const revenueCol = dataset.roles.revenue?.column;
  if (!customerCol || !revenueCol) {
    return deps.unavailable("Missing customer_id or revenue column", ["customer_id", "revenue"], dataset);
  }
  const timestampCol = dataset.roles.timestamp?.column;
  const filter = deps.buildFilterClause(dataset, filters);
  const rows = await deps.withQueryTiming("clv", () =>
    deps.all<{
      customer_id: string;
      monetary: number;
      frequency: number;
      recency_days: number | null;
      predicted_clv: number;
    }>(
      `
        with customer_agg as (
          select
            cast(${deps.toIdentifier(customerCol)} as varchar) as customer_id,
            coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as monetary,
            count(*) as frequency
            ${
              timestampCol
                ? `,
            datediff('day', max(${deps.toIdentifier(timestampCol)}), max(max(${deps.toIdentifier(timestampCol)})) over ()) as recency_days`
                : ", null as recency_days"
            }
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          group by 1
        ),
        stats as (
          select
            max(frequency) as max_frequency,
            max(coalesce(recency_days, 0)) as max_recency
          from customer_agg
        )
        select
          customer_id,
          monetary,
          frequency,
          recency_days,
          monetary * (
            1
            + (frequency / greatest(1, stats.max_frequency)) * 0.6
            + ${
              timestampCol
                ? `(1 - (coalesce(recency_days, 0) / greatest(1, stats.max_recency))) * 0.4`
                : "0.2"
            }
          ) as predicted_clv
        from customer_agg, stats
        order by predicted_clv desc
        limit 500
      `,
      filter.params
    )
  );
  if (!rows.length) {
    return deps.unavailable("No data for selected filters", ["customer_id", "revenue"], dataset);
  }
  const customers = rows.map((row) => {
    const predictedClv = Number(row.predicted_clv);
    let segment: "high_value" | "mid_value" | "low_value";
    if (predictedClv > 2000) segment = "high_value";
    else if (predictedClv > 500) segment = "mid_value";
    else segment = "low_value";
    return {
      customerId: row.customer_id,
      recencyDays: row.recency_days,
      frequency: Number(row.frequency),
      monetary: Number(row.monetary),
      predictedClv,
      segment,
    };
  });
  return {
    status: "ok",
    data: {
      model: "Adaptive CLV",
      strategy: "adaptive_regression_like",
      features: timestampCol ? ["monetary", "frequency", "recency_days"] : ["monetary", "frequency"],
      featureImportance: timestampCol
        ? [
            { feature: "monetary", importance: 0.5 },
            { feature: "frequency", importance: 0.3 },
            { feature: "recency_days", importance: 0.2 },
          ]
        : [
            { feature: "monetary", importance: 0.6 },
            { feature: "frequency", importance: 0.4 },
          ],
      customers,
    },
    meta: {
      unappliedFilters: filter.unapplied,
      timestampFallback: !timestampCol,
    },
  };
};
