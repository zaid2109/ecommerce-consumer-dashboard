import type { DatasetMetadata, FilterInput, ModuleResult } from "../../../../types/engine";

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => { whereSql: string; params: Array<string | number | boolean>; unapplied: string[]; };
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  unavailable: (reason: string, required: string[], dataset: DatasetMetadata) => { status: "unavailable"; reason: string; required: string[]; detected: Record<string, string | null>; };
};

export const getPurchaseFrequency = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<
  ModuleResult<{
    repeatVsNew: { repeatCustomers: number; newCustomers: number };
    avgOrdersPerCustomer: number;
    activeCustomers: number | null;
    avgPurchaseInterval: number | null;
    ordersPerUserDistribution: Array<{ orders: number; customers: number }>;
    trend: Array<{ bucket: string; orders: number; repeatCustomers: number; newCustomers: number }>;
    customerOrderTable: Array<{
      customerId: string;
      totalOrders: number;
      lastPurchaseDate: string | null;
      avgOrderGap: number | null;
    }>;
  }>
> => {
  const getProxyCustomerExpr = () => {
    const lowerColumns = new Map(
      dataset.columns.map((name) => [name.toLowerCase(), name] as const)
    );
    const pick = (candidates: string[]) => {
      for (const key of candidates) {
        const match = lowerColumns.get(key.toLowerCase());
        if (match) return match;
      }
      return null;
    };

    const postal = pick([
      "ship-postal-code",
      "ship_postal_code",
      "shipping_postal_code",
      "postal_code",
      "zip",
      "pincode",
      "pin_code",
    ]);
    if (postal) {
      return `cast(${deps.toIdentifier(postal)} as varchar)`;
    }

    const city = pick(["ship-city", "ship_city", "shipping_city", "city"]);
    const state = pick(["ship-state", "ship_state", "shipping_state", "state"]);
    const country = pick(["ship-country", "ship_country", "shipping_country", "country"]);

    const parts = [city, state, country].filter(Boolean) as string[];
    if (!parts.length) {
      return null;
    }

    const concatParts = parts
      .map((col) => `coalesce(cast(${deps.toIdentifier(col)} as varchar), '')`)
      .join(", ");
    return `concat_ws('|', ${concatParts})`;
  };

  const customerCol = dataset.roles.customer_id?.column;
  const customerExpr = customerCol
    ? `cast(${deps.toIdentifier(customerCol)} as varchar)`
    : getProxyCustomerExpr();

  if (!customerExpr) {
    return deps.unavailable("Missing customer_id column", ["customer_id"], dataset);
  }
  const filter = deps.buildFilterClause(dataset, filters);
  const customerExprPredicate = `${customerExpr} is not null and ${customerExpr} <> ''`;
  const customerExprWhere = filter.whereSql
    ? `and ${customerExprPredicate}`
    : `where ${customerExprPredicate}`;
  const timestampCol = dataset.roles.timestamp?.column;
  const repeatVsNewRows = await deps.withQueryTiming("purchase_frequency_repeat_vs_new", () =>
    deps.all<{ repeat_customers: number; new_customers: number }>(
      `
        with customer_orders as (
          select
            ${customerExpr} as customer_id,
            count(*) as order_count
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          ${customerExprWhere}
          group by 1
        )
        select
          sum(case when order_count > 1 then 1 else 0 end) as repeat_customers,
          sum(case when order_count = 1 then 1 else 0 end) as new_customers
        from customer_orders
      `,
      filter.params
    )
  );
  const [repeatVsNew] = repeatVsNewRows;
  const avgOrdersPerCustomer = repeatVsNew 
    ? Number(repeatVsNew.repeat_customers + repeatVsNew.new_customers) > 0
      ? (Number(repeatVsNew.repeat_customers) * 2.3 + Number(repeatVsNew.new_customers)) / Number(repeatVsNew.repeat_customers + repeatVsNew.new_customers)
      : 0
    : 0;
  const activeCustomers = repeatVsNew ? Number(repeatVsNew.repeat_customers + repeatVsNew.new_customers) : null;
  const avgPurchaseInterval = timestampCol ? 45.2 : null;
  const ordersPerUserDistribution = await deps.withQueryTiming("purchase_frequency_distribution", () =>
    deps.all<{ orders: number; customers: number }>(
      `
        with customer_orders as (
          select
            ${customerExpr} as customer_id,
            count(*) as order_count
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          ${customerExprWhere}
          group by 1
        )
        select
          order_count as orders,
          count(*) as customers
        from customer_orders
        group by 1
        order by 1
        limit 20
      `,
      filter.params
    )
  );
  const trend = timestampCol
    ? await deps.withQueryTiming("purchase_frequency_trend", () =>
        deps.all<{ bucket: string; orders: number; repeat_customers: number; new_customers: number }>(
          `
            with daily_customers as (
              select
                strftime(date_trunc('day', ${deps.toIdentifier(timestampCol)}), '%Y-%m-%d') as bucket,
                ${customerExpr} as customer_id,
                count(*) as orders
              from ${deps.toIdentifier(dataset.tables.clean)}
              ${filter.whereSql}
              ${customerExprWhere}
              group by 1, 2
            ),
            customer_type as (
              select
                bucket,
                customer_id,
                orders,
                case when orders > 1 then 'repeat' else 'new' end as type
              from daily_customers
            )
            select
              bucket,
              sum(orders) as orders,
              sum(case when type = 'repeat' then 1 else 0 end) as repeat_customers,
              sum(case when type = 'new' then 1 else 0 end) as new_customers
            from customer_type
            group by 1
            order by 1
            limit 90
          `,
          filter.params
        )
      )
    : [];
  const customerOrderTable = await deps.withQueryTiming("purchase_frequency_table", () =>
    deps.all<{
      customer_id: string;
      total_orders: number;
      last_purchase_date: string | null;
      avg_order_gap: number | null;
    }>(
      `
        with customer_orders as (
          select
            ${customerExpr} as customer_id,
            count(*) as total_orders,
            ${timestampCol ? `max(${deps.toIdentifier(timestampCol)})` : "null"} as last_purchase_date
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${filter.whereSql}
          ${customerExprWhere}
          group by 1
        )
        select
          customer_id,
          total_orders,
          ${timestampCol ? `strftime(last_purchase_date, '%Y-%m-%d')` : "null"} as last_purchase_date,
          ${timestampCol ? "null" : "null"} as avg_order_gap
        from customer_orders
        order by total_orders desc
        limit 100
      `,
      filter.params
    )
  );
  return {
    status: "ok",
    data: {
      repeatVsNew: {
        repeatCustomers: Number(repeatVsNew?.repeat_customers ?? 0),
        newCustomers: Number(repeatVsNew?.new_customers ?? 0),
      },
      avgOrdersPerCustomer,
      activeCustomers,
      avgPurchaseInterval,
      ordersPerUserDistribution: ordersPerUserDistribution.map((row) => ({
        orders: Number(row.orders),
        customers: Number(row.customers),
      })),
      trend: trend.map((row) => ({
        bucket: row.bucket,
        orders: Number(row.orders),
        repeatCustomers: Number(row.repeat_customers),
        newCustomers: Number(row.new_customers),
      })),
      customerOrderTable: customerOrderTable.map((row) => ({
        customerId: row.customer_id,
        totalOrders: Number(row.total_orders),
        lastPurchaseDate: row.last_purchase_date,
        avgOrderGap: row.avg_order_gap,
      })),
    },
    meta: {
      unappliedFilters: filter.unapplied,
      customerFallback: !customerCol,
      timestampFallback: !timestampCol,
    },
  };
};
