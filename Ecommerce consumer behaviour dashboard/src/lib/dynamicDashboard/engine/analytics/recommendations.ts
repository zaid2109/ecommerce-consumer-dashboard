import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getRecommendations = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    strategy: "collaborative" | "popularity";
    recommendations: Array<{ customerId: string; items: Array<{ productId: string; score: number }> }>;
    popular: Array<{ productId: string; score: number }>;
  }>
> => {
  const productCol = dataset.roles.product_id?.column;
  if (!productCol) {
    return deps.unavailable("Missing product_id column", ["product_id"], dataset);
  }
  const customerCol = dataset.roles.customer_id?.column;
  const filter = deps.buildFilterClause(dataset, filters);
  const popular = await deps.withQueryTiming("recommendations_popular", () =>
    deps.all<{ product_id: string; score: number }>(
      `
        select
          cast(${deps.toIdentifier(productCol)} as varchar) as product_id,
          count(*) as score
        from ${deps.toIdentifier(dataset.tables.clean)}
        ${filter.whereSql}
        where ${deps.toIdentifier(productCol)} is not null
        group by 1
        order by 2 desc
        limit 40
      `,
      filter.params
    )
  );
  if (!popular.length) {
    return deps.unavailable("No data for selected filters", ["product_id"], dataset);
  }
  if (!customerCol) {
    return {
      status: "ok",
      data: {
        strategy: "popularity",
        recommendations: [],
        popular: popular.map((row) => ({
          productId: row.product_id,
          score: Number(row.score),
        })),
      },
      meta: {
        unappliedFilters: filter.unapplied,
        customerFallback: true,
      },
    };
  }
  const recRows = await deps.withQueryTiming("recommendations_by_customer", () =>
    deps.all<{ customer_id: string; product_id: string; score: number }>(
      `
        with customer_history as (
          select distinct
            cast(${deps.toIdentifier(customerCol)} as varchar) as customer_id,
            cast(${deps.toIdentifier(productCol)} as varchar) as product_id
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          where ${deps.toIdentifier(customerCol)} is not null and ${deps.toIdentifier(productCol)} is not null
        ),
        top_customers as (
          select customer_id, count(*) as orders
          from customer_history
          group by 1
          order by 2 desc
          limit 50
        ),
        popular as (
          select product_id, count(*) as score
          from customer_history
          group by 1
          order by 2 desc
          limit 100
        )
        select
          tc.customer_id,
          p.product_id,
          p.score
        from top_customers tc
        cross join popular p
        left join customer_history ch
          on ch.customer_id = tc.customer_id and ch.product_id = p.product_id
        where ch.product_id is null
        qualify row_number() over (partition by tc.customer_id order by p.score desc, p.product_id) <= 5
      `,
      filter.params
    )
  );
  const grouped = new Map<string, Array<{ productId: string; score: number }>>();
  recRows.forEach((row) => {
    const current = grouped.get(row.customer_id) ?? [];
    current.push({
      productId: row.product_id,
      score: Number(row.score),
    });
    grouped.set(row.customer_id, current);
  });
  return {
    status: "ok",
    data: {
      strategy: "collaborative",
      recommendations: Array.from(grouped.entries()).map(([customerId, items]) => ({
        customerId,
        items,
      })),
      popular: popular.map((row) => ({
        productId: row.product_id,
        score: Number(row.score),
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      customerFallback: false,
    },
  };
};
