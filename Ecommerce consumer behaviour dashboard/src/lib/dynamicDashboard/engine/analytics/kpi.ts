import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  hasUsableRows: (dataset: DatasetMetadata, whereSql: string, params: Array<string | number | boolean>) => Promise<number>;
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getKpis = async (dataset: DatasetMetadata, filters: FilterInput, deps: Deps): Promise<ModuleResult<Record<string, number>>> => {
  const revenueCol = dataset.roles.revenue?.column;
  if (!revenueCol) {
    return deps.unavailable("Missing revenue column", ["revenue"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const rowCount = await deps.hasUsableRows(dataset, filter.whereSql, filter.params);
  if (rowCount === 0) {
    return deps.unavailable("No data for selected filters", ["revenue"], dataset);
  }
  const orderCol = dataset.roles.order_id?.column;
  const quantityCol = dataset.roles.quantity?.column;
  const sql = `
    select
      coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue,
      ${orderCol ? `count(distinct ${deps.toIdentifier(orderCol)})` : "count(*)"} as orders,
      ${quantityCol ? `coalesce(sum(${deps.toIdentifier(quantityCol)}), 0)` : "count(*)"} as quantity
    from ${deps.toIdentifier(dataset.tables.clean)}
    ${filter.whereSql}
  `;
  const [result] = await deps.withQueryTiming("kpis", () =>
    deps.all<{ revenue: number; orders: number; quantity: number }>(sql, filter.params)
  );
  return {
    status: "ok",
    data: {
      revenue: Number(result?.revenue ?? 0),
      orders: Number(result?.orders ?? 0),
      quantity: Number(result?.quantity ?? 0),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      orderCountFallback: !orderCol,
    },
  };
};
