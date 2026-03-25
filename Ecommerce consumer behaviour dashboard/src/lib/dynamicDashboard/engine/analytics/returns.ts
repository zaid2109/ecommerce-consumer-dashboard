import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
  truthyStatusExpression: (columnName: string) => string;
};

export const getReturns = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    byStatus: Array<{ status: string; count: number; refundAmount: number }>;
    returnRateByCategory: Array<{ category: string; returnRate: number; returned: number; total: number }>;
    refundTrend: Array<{ bucket: string; refundAmount: number }>;
    highReturnProducts: Array<{ product: string; returned: number }>;
    returnReasons: Array<{ reason: string; count: number }>;
    returnOrders: Array<{
      orderId: string;
      category: string | null;
      returnStatus: string;
      refundAmount: number;
    }>;
  }>
> => {
  const returnStatusCol = dataset.roles.return_status?.column;
  if (!returnStatusCol) {
    return deps.unavailable("Missing return status column", ["return_status"], dataset);
  }
  const refundCol = dataset.roles.refund_amount?.column;
  const categoryCol = dataset.roles.category?.column;
  const productCol = dataset.roles.product_id?.column;
  const orderCol = dataset.roles.order_id?.column;
  const timestampCol = dataset.roles.timestamp?.column;
  const reasonCol =
    dataset.schema.find((column) => /reason/i.test(column.name) && column.inferredType !== "numerical")
      ?.name ?? null;
  const filter = deps.buildFilterClause(dataset, filters);
  const returnedFlag = deps.truthyStatusExpression(returnStatusCol);
  const rows = await deps.withQueryTiming("returns", () =>
    deps.all<{ status: string; count: number; refund_amount: number }>(
      `
      select
        ${deps.toIdentifier(returnStatusCol)} as status,
        count(*) as count,
        ${refundCol ? `coalesce(sum(${deps.toIdentifier(refundCol)}), 0)` : "0"} as refund_amount
      from ${deps.toIdentifier(dataset.tables.clean)}
      ${filter.whereSql}
      group by 1
      order by 2 desc
      limit 20
    `,
      filter.params
    )
  );
  if (!rows.length) {
    return deps.unavailable("No data for selected filters", ["return_status"], dataset);
  }
  const [returnRateByCategory, refundTrend, highReturnProducts, returnReasons, returnOrders] =
    await Promise.all([
      categoryCol
        ? deps.withQueryTiming("returns_by_category", () =>
            deps.all<{ category: string; returned: number; total: number }>(
              `
                select
                  ${deps.toIdentifier(categoryCol)} as category,
                  sum(${returnedFlag}) as returned,
                  count(*) as total
                from ${deps.toIdentifier(dataset.tables.clean)}
                ${filter.whereSql}
                group by 1
                order by returned desc
                limit 20
              `,
              filter.params
            )
          )
        : Promise.resolve([] as Array<{ category: string; returned: number; total: number }>),
      timestampCol && refundCol
        ? deps.withQueryTiming("refund_trend", () =>
            deps.all<{ bucket: string; refund_amount: number }>(
              `
                select
                  strftime(date_trunc('day', ${deps.toIdentifier(timestampCol)}), '%Y-%m-%d') as bucket,
                  coalesce(sum(${deps.toIdentifier(refundCol)}), 0) as refund_amount
                from ${deps.toIdentifier(dataset.tables.clean)}
                ${filter.whereSql}
                group by 1
                order by 1
                limit 100
              `,
              filter.params
            )
          )
        : Promise.resolve([] as Array<{ bucket: string; refund_amount: number }>),
      productCol
        ? deps.withQueryTiming("high_return_products", () =>
            deps.all<{ product: string; returned: number }>(
              `
                select
                  cast(${deps.toIdentifier(productCol)} as varchar) as product,
                  sum(${returnedFlag}) as returned
                from ${deps.toIdentifier(dataset.tables.clean)}
                ${filter.whereSql}
                group by 1
                having sum(${returnedFlag}) > 0
                order by returned desc
                limit 20
              `,
              filter.params
            )
          )
        : Promise.resolve([] as Array<{ product: string; returned: number }>),
      reasonCol
        ? deps.withQueryTiming("return_reasons", () =>
            deps.all<{ reason: string; count: number }>(
              `
                select
                  cast(${deps.toIdentifier(reasonCol)} as varchar) as reason,
                  count(*) as count
                from ${deps.toIdentifier(dataset.tables.clean)}
                ${filter.whereSql}
                group by 1
                order by 2 desc
                limit 10
              `,
              filter.params
            )
          )
        : Promise.resolve([] as Array<{ reason: string; count: number }>),
      orderCol && returnStatusCol && refundCol
        ? deps.withQueryTiming("return_orders", () =>
            deps.all<{
              order_id: string;
              category: string | null;
              return_status: string;
              refund_amount: number;
            }>(
              `
                select
                  cast(${deps.toIdentifier(orderCol)} as varchar) as order_id,
                  ${categoryCol ? `cast(${deps.toIdentifier(categoryCol)} as varchar)` : "'null'"} as category,
                  cast(${deps.toIdentifier(returnStatusCol)} as varchar) as return_status,
                  ${refundCol ? `coalesce(${deps.toIdentifier(refundCol)}, 0)` : "0"} as refund_amount
                from ${deps.toIdentifier(dataset.tables.clean)}
                ${filter.whereSql}
                ${returnStatusCol ? `and ${returnedFlag} = 1` : ""}
                order by ${timestampCol ? deps.toIdentifier(timestampCol) : deps.toIdentifier(orderCol)} desc
                limit 50
              `,
              filter.params
            )
          )
        : Promise.resolve([] as Array<{ order_id: string; category: string | null; return_status: string; refund_amount: number }>),
    ]);
  return {
    status: "ok",
    data: {
      byStatus: rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
        refundAmount: Number(row.refund_amount),
      })),
      returnRateByCategory: returnRateByCategory.map((row) => ({
        category: row.category,
        returnRate: Number(row.returned) / Math.max(1, Number(row.total)),
        returned: Number(row.returned),
        total: Number(row.total),
      })),
      refundTrend: refundTrend.map((row) => ({
        bucket: row.bucket,
        refundAmount: Number(row.refund_amount),
      })),
      highReturnProducts: highReturnProducts.map((row) => ({
        product: row.product,
        returned: Number(row.returned),
      })),
      returnReasons: returnReasons.map((row) => ({
        reason: row.reason,
        count: Number(row.count),
      })),
      returnOrders: returnOrders.map((row) => ({
        orderId: row.order_id,
        category: row.category,
        returnStatus: row.return_status,
        refundAmount: Number(row.refund_amount),
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
    },
  };
};
