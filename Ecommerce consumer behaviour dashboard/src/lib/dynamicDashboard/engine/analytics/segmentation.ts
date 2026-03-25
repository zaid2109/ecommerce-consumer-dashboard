import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getCustomerSegments = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    segments: Array<{ segment: string; customers: number; revenue: number }>;
    customerRfm: Array<{
      customerId: string;
      recencyDays: number | null;
      frequency: number;
      monetary: number;
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
  const rows = await deps.withQueryTiming("customer_segments", () =>
    deps.all<{
      customer_id: string;
      recency_days: number | null;
      frequency: number;
      monetary: number;
      segment: "high_value" | "mid_value" | "low_value";
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
        )
        select
          customer_id,
          recency_days,
          frequency,
          monetary,
          case
            when monetary >= quantile_cont(monetary, 0.8) over () then 'high_value'
            when monetary >= quantile_cont(monetary, 0.5) over () then 'mid_value'
            else 'low_value'
          end as segment
        from customer_agg
        order by monetary desc
        limit 800
      `,
      filter.params
    )
  );
  if (!rows.length) {
    return deps.unavailable("No data for selected filters", ["customer_id", "revenue"], dataset);
  }
  const segmentBuckets = new Map<string, { customers: number; revenue: number }>();
  rows.forEach((row) => {
    const current = segmentBuckets.get(row.segment) ?? { customers: 0, revenue: 0 };
    current.customers += 1;
    current.revenue += Number(row.monetary);
    segmentBuckets.set(row.segment, current);
  });
  const segments = Array.from(segmentBuckets.entries())
    .map(([segment, values]) => ({
      segment,
      customers: values.customers,
      revenue: values.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  return {
    status: "ok",
    data: {
      segments,
      customerRfm: rows.map((row) => ({
        customerId: row.customer_id,
        recencyDays: row.recency_days,
        frequency: Number(row.frequency),
        monetary: Number(row.monetary),
        segment: row.segment,
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      recencyFallback: !timestampCol,
    },
  };
};
