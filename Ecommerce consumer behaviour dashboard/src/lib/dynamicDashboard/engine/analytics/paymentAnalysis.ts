import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
  truthyStatusExpression: (columnName: string) => string;
  falsyStatusExpression: (columnName: string) => string;
};

export const getPaymentAnalysis = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    paymentMethods: Array<{
      method: string;
      revenue: number;
      orders: number;
      successCount: number;
      failureCount: number;
      successRate: number | null;
    }>;
    trend: Array<{ bucket: string; method: string; orders: number; revenue: number }>;
    totals: { totalTransactions: number; codTransactions: number; onlineTransactions: number };
  }>
> => {
  const paymentMethodCol = dataset.roles.payment_method?.column;
  const revenueCol = dataset.roles.revenue?.column;
  if (!paymentMethodCol || !revenueCol) {
    return deps.unavailable("Missing payment method or revenue column", ["payment_method", "revenue"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const orderCol = dataset.roles.order_id?.column;
  const paymentStatusCol = dataset.roles.payment_status?.column;
  const timestampCol = dataset.roles.timestamp?.column;
  const successExpression = paymentStatusCol ? `sum(${deps.truthyStatusExpression(paymentStatusCol)})` : "null";
  const failureExpression = paymentStatusCol ? `sum(${deps.falsyStatusExpression(paymentStatusCol)})` : "null";
  const rows = await deps.withQueryTiming("payment_analysis", () =>
    deps.all<{
      method: string;
      revenue: number;
      orders: number;
      success_count: number | null;
      failure_count: number | null;
    }>(
      `
      select
        ${deps.toIdentifier(paymentMethodCol)} as method,
        coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue,
        ${orderCol ? `count(distinct ${deps.toIdentifier(orderCol)})` : "count(*)"} as orders,
        ${successExpression} as success_count,
        ${failureExpression} as failure_count
      from ${deps.toIdentifier(dataset.tables.clean)}
      ${filter.whereSql}
      group by 1
      order by 2 desc
      limit 30
    `,
      filter.params
    )
  );
  const trendRows = timestampCol
    ? await deps.withQueryTiming("payment_analysis_trend", () =>
        deps.all<{ bucket: string; method: string; orders: number; revenue: number }>(
          `
            select
              strftime(date_trunc('day', ${deps.toIdentifier(timestampCol)}), '%Y-%m-%d') as bucket,
              ${deps.toIdentifier(paymentMethodCol)} as method,
              ${orderCol ? `count(distinct ${deps.toIdentifier(orderCol)})` : "count(*)"} as orders,
              coalesce(sum(${deps.toIdentifier(revenueCol)}), 0) as revenue
            from ${deps.toIdentifier(dataset.tables.clean)}
            ${filter.whereSql}
            group by 1, 2
            order by 1, 3 desc
            limit 500
          `,
          filter.params
        )
      )
    : [];
  if (!rows.length) {
    return deps.unavailable("No data for selected filters", ["payment_method", "revenue"], dataset);
  }
  const totalTransactions = rows.reduce((sum, row) => sum + Number(row.orders), 0);
  const codTransactions = rows
    .filter((row) => String(row.method).toLowerCase().includes("cod"))
    .reduce((sum, row) => sum + Number(row.orders), 0);
  return {
    status: "ok",
    data: {
      paymentMethods: rows.map((row) => ({
        method: row.method,
        revenue: Number(row.revenue),
        orders: Number(row.orders),
        successCount: Number(row.success_count ?? 0),
        failureCount: Number(row.failure_count ?? 0),
        successRate:
          row.success_count === null
            ? null
            : Number(row.success_count ?? 0) / Math.max(1, Number(row.orders ?? 0)),
      })),
      trend: trendRows.map((row) => ({
        bucket: row.bucket,
        method: row.method,
        orders: Number(row.orders),
        revenue: Number(row.revenue),
      })),
      totals: {
        totalTransactions,
        codTransactions,
        onlineTransactions: totalTransactions - codTransactions,
      },
    },
    meta: {
      unappliedFilters: filter.unapplied,
      orderCountFallback: !orderCol,
    },
  };
};
