import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getRevenueByCategory = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  topN: number,
  deps: Deps
): Promise<
  ModuleResult<{ categories: Array<{ name: string; revenue: number; orders: number; avgOrderValue: number }> }>
> => {
  const categoryCol = dataset.roles.category?.column;
  const revenueCol = dataset.roles.revenue?.column;
  if (!categoryCol || !revenueCol) {
    return deps.unavailable("Missing category or revenue column", ["category", "revenue"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const orderCol = dataset.roles.order_id?.column;
  const rows = await deps.withQueryTiming("revenue_by_category", () =>
    deps.all<{ category: string; revenue: number; orders: number }>(
      `
      select
        ${deps.toIdentifier(categoryCol)} as category,
        coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue,
        ${orderCol ? `count(distinct ${deps.toIdentifier(orderCol)})` : "count(*)"} as orders
      from ${deps.toIdentifier(dataset.tables.clean)}
      ${filter.whereSql}
      group by 1
      order by 2 desc
      limit ${Math.max(1, topN)}
    `,
      filter.params
    )
  );
  if (!rows.length) {
    return deps.unavailable("No data for selected filters", ["category", "revenue"], dataset);
  }
  return {
    status: "ok",
    data: {
      categories: rows.map((row) => ({
        name: row.category,
        revenue: Number(row.revenue),
        orders: Number(row.orders),
        avgOrderValue: Number(row.revenue) / Math.max(1, Number(row.orders)),
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      orderCountFallback: !orderCol,
    },
  };
};
