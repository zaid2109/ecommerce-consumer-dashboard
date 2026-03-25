import type {
  ColumnType,
  DatasetColumn,
  DatasetModuleAvailability,
  RoleCandidate,
  RoleMap,
  RoleSelection,
} from "../../../types/engine";

type Deps = {
  clamp: (value: number, min?: number, max?: number) => number;
  threshold: number;
};

const rolePatterns: Record<string, RegExp[]> = {
  customer_id: [
    /customer/i,
    /client/i,
    /buyer/i,
    /user/i,
    /account/i,
    /member/i,
    /email/i,
    /e[-_\s]?mail/i,
    /phone/i,
    /mobile/i,
    /ship.*name/i,
    /shipping.*name/i,
    /ship.*postal/i,
    /shipping.*postal/i,
    /postal/i,
    /zip/i,
    /pincode/i,
    /pin[-_\s]?code/i,
    /dim_customer_key/i,
  ],
  order_id: [/order/i, /invoice/i, /transaction/i, /receipt/i, /cart_id/i],
  product_id: [/product/i, /sku/i, /item/i, /product_id/i],
  category: [/category/i, /segment/i, /group/i, /type/i, /city/i, /region/i, /location/i],
  revenue: [/revenue/i, /sales/i, /amount/i, /value/i, /price/i, /total/i, /landing_price/i],
  quantity: [/quantity/i, /qty/i, /units?/i, /count/i],
  timestamp: [/date/i, /time/i, /timestamp/i, /created/i, /ordered/i],
  payment_method: [/payment/i, /method/i, /channel/i, /tender/i],
  payment_status: [/payment.*status/i, /status.*payment/i, /paid/i],
  return_status: [/return/i, /refund.*status/i],
  refund_amount: [/refund/i, /chargeback/i, /returned.*amount/i],
};

const roleTypeCompatibility: Record<string, ColumnType[]> = {
  customer_id: ["text", "categorical", "numerical"],
  order_id: ["text", "categorical", "numerical"],
  product_id: ["text", "categorical", "numerical"],
  category: ["categorical", "text"],
  revenue: ["numerical"],
  quantity: ["numerical"],
  timestamp: ["datetime"],
  payment_method: ["categorical", "text"],
  payment_status: ["categorical", "text", "boolean"],
  return_status: ["categorical", "text", "boolean"],
  refund_amount: ["numerical"],
};

const roleOverrides: Record<string, string[]> = {
  timestamp: ["date_", "order_date", "date"],
  revenue: [
    "total_weighted_landing_price",
    "total_price",
    "unit_selling_price",
    "price",
  ],
  customer_id: [
    "dim_customer_key",
    "customer_id",
    "customerid",
    "buyer_id",
    "user_id",
    "account_id",
    "email",
    "e-mail",
    "phone",
    "mobile",
    "ship-postal-code",
    "ship_postal_code",
    "shipping_postal_code",
    "postal_code",
    "zip",
    "pincode",
  ],
  order_id: ["order_id", "cart_id"],
  product_id: ["product_id"],
  category: ["city_name", "category"],
  quantity: ["procured_quantity", "quantity"],
};

export const inferRoles = (columns: DatasetColumn[], deps: Deps): RoleMap => {
  const roles: RoleMap = {};
  const columnNames = new Map(
    columns.map((column) => [column.name.toLowerCase(), column.name])
  );
  Object.entries(rolePatterns).forEach(([role, patterns]) => {
    const overrides = roleOverrides[role] ?? [];
    for (const override of overrides) {
      const matched = columnNames.get(override.toLowerCase());
      if (matched) {
        roles[role] = {
          column: matched,
          confidence: 1,
          candidates: [{ column: matched, confidence: 1, nullRate: 0 }],
          reasoning: "Selected explicit override for known schema",
        };
        return;
      }
    }
    const candidates: RoleCandidate[] = columns.map((column) => {
      const baseName = column.name.toLowerCase();
      const nameHits = patterns.reduce(
        (sum, pattern) => sum + (pattern.test(baseName) ? 1 : 0),
        0
      );
      const nameScore = deps.clamp(nameHits / Math.max(1, patterns.length));
      const typeScore = roleTypeCompatibility[role].includes(column.inferredType) ? 1 : 0;
      const qualityScore = 1 - column.nullRate;
      const confidence = deps.clamp(nameScore * 0.65 + typeScore * 0.2 + qualityScore * 0.15);
      return {
        column: column.name,
        confidence,
        nullRate: column.nullRate,
      };
    });
    const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
    const selected = sorted[0];
    const selection: RoleSelection = {
      column: null,
      confidence: 0,
      candidates: sorted.slice(0, 3),
      reasoning: "No candidate reached confidence threshold",
    };
    if (selected && selected.confidence >= deps.threshold) {
      selection.column = selected.column;
      selection.confidence = Number(selected.confidence.toFixed(3));
      selection.reasoning = "Selected highest-confidence candidate with best data quality";
    }
    roles[role] = selection;
  });
  return roles;
};

export const buildModuleAvailability = (roles: RoleMap): DatasetModuleAvailability => {
  const detected = Object.fromEntries(
    Object.entries(roles).map(([key, role]) => [key, role?.column ?? null])
  ) as Record<string, string | null>;

  const spec: Record<string, string[]> = {
    kpis: ["revenue"],
    "time-series": ["revenue"],
    "revenue-by-category": ["revenue"],
    "purchase-frequency": ["customer_id"],
    "payment-analysis": ["payment_method", "revenue"],
    returns: ["return_status"],
    "customer-segments": ["customer_id", "revenue"],
    anomalies: ["revenue"],
    clv: ["customer_id", "revenue"],
    recommendations: ["product_id"],
    insights: ["revenue"],
  };

  const availability: DatasetModuleAvailability = {};
  Object.entries(spec).forEach(([moduleId, required]) => {
    const enabled = required.every((roleKey) => Boolean(roles[roleKey]?.column));
    availability[moduleId] = {
      enabled,
      required,
      detected,
    };
  });
  return availability;
};
