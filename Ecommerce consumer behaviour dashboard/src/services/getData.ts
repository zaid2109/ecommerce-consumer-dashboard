import { headers } from "next/headers";

import type { CalendarEvent } from "../components/views/calendar/types";
import type { Customer } from "../components/views/customers/types";
import type { HomepageData } from "../components/views/homepage/types";
import type { OrderType } from "../components/views/orders/types";
import type { Product } from "../components/views/products/types";

interface OrderItem {
  order_id: string | number;
  product_id: string | number;
  customer_id: string | number;
  revenue: string | number;
  city_name?: string;
  order_date: string;
}

interface OrdersResponse {
  data: {
    items: OrderItem[];
  };
}

interface HomepageResponse {
  data: HomepageData;
}

interface ItemsResponse {
  data: {
    items: JsonValue[];
  };
}

const asString = (value: JsonValue | undefined, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
};

const asNumber = (value: JsonValue | undefined, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const asObject = (value: JsonValue): JsonObject | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
};

const requestTimeoutMs = Number(process.env.NEXT_FETCH_TIMEOUT_MS ?? "1500");

const getSiteUrl = async () => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) {
    return "http://localhost:3000";
  }
  return `${proto}://${host}`;
};

const getBackendCandidates = async () => {
  const envUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const hostValue = host?.split(",")[0].trim() ?? "";
  const hostname = hostValue.split(":")[0] || "";
  const candidates = [
    envUrl,
    hostname ? `http://${hostname}:8000` : undefined,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://backend:8000",
  ]
    .filter(Boolean)
    .map((value) => (value as string).replace(/\/$/, ""));
  return Array.from(new Set(candidates));
};

const fetchJson = async <T>(url: string): Promise<{ response: Response; data: T }> => {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const data = (await response.json()) as T;
  return { response, data };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchFirst = async <T>(urls: string[]): Promise<T> => {
  for (const url of urls) {
    try {
      const { response, data } = await fetchJson<T>(url);
      if (response.ok) {
        return data;
      }
    } catch {
      continue;
    }
  }
  throw new Error("Failed to fetch data from backend");
};

const healBackend = async (backendCandidates: string[]) => {
  for (const base of backendCandidates) {
    try {
      const response = await fetch(`${base}/default-dataset/load-sales`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
};

const fetchWithHeal = async <T>(urls: string[], backendCandidates: string[]): Promise<T> => {
  try {
    return await fetchFirst<T>(urls);
  } catch {
    await healBackend(backendCandidates);
    await wait(150);
    return await fetchFirst<T>(urls);
  }
};

export async function getData(pageName: "homepage"): Promise<HomepageData>;
export async function getData(pageName: "orders"): Promise<OrderType[]>;
export async function getData(pageName: "customers"): Promise<Customer[]>;
export async function getData(pageName: "products"): Promise<Product[]>;
export async function getData(pageName: "events"): Promise<CalendarEvent[]>;
export async function getData(
  pageName: string
): Promise<HomepageData | OrderType[] | Customer[] | Product[] | CalendarEvent[]>;

export async function getData(
  pageName: string
): Promise<HomepageData | OrderType[] | Customer[] | Product[] | CalendarEvent[]> {
  const siteUrl = await getSiteUrl();
  const backendCandidates = await getBackendCandidates();
  const apiUrls = (path: string) => [
    `${siteUrl}/api/${path}`,
    ...backendCandidates.map((base) => `${base}/${path}`),
  ];
  if (pageName === "orders") {
    const json = await fetchWithHeal<OrdersResponse>(apiUrls("orders"), backendCandidates).catch(
      (): OrdersResponse => ({
        data: { items: [] },
      })
    );
    return (json.data?.items ?? []).map((row): OrderType => ({
      orderId: typeof row.order_id === "number" ? row.order_id : asNumber(String(row.order_id)),
      productName: `Product ${row.product_id}`,
      user: `Customer ${row.customer_id}`,
      price: typeof row.revenue === "number" ? row.revenue : asNumber(String(row.revenue)),
      deliveryType: row.city_name ?? "",
      date: row.order_date,
      status: "",
      col1: typeof row.order_id === "number" ? row.order_id : asNumber(String(row.order_id)),
      col2: `Product ${row.product_id}`,
      col3: `Customer ${row.customer_id}`,
      col4: typeof row.revenue === "number" ? row.revenue : asNumber(String(row.revenue)),
      col5: row.city_name ?? "",
      col6: row.order_date,
      col7: "",
    }));
  }
  if (pageName === "homepage") {
    const json = await fetchWithHeal<HomepageResponse>(apiUrls("homepage"), backendCandidates).catch(
      (): HomepageResponse => ({
        data: {
          homeSmallCards: [],
          revenueOverTime: [],
          regions: [],
          bestSellingProducts: [],
          customerSatisfaction: [],
          revenuePerCountry: [],
        },
      })
    );
    return json.data;
  }
  if (pageName === "customers") {
    const json = await fetchWithHeal<ItemsResponse>(apiUrls("customers"), backendCandidates).catch(
      (): ItemsResponse => ({
        data: { items: [] },
      })
    );
    const items = json.data?.items ?? [];
    return items.map((value): Customer => {
      const obj = asObject(value) ?? {};
      return {
        photo: asString(obj.photo, ""),
        firstName: asString(obj.firstName, ""),
        lastName: asString(obj.lastName, ""),
        city: asString(obj.city, ""),
        country: asString(obj.country, ""),
        phone: asString(obj.phone, ""),
        totalBuys: asNumber(obj.totalBuys, 0),
      };
    });
  }
  if (pageName === "products") {
    const json = await fetchWithHeal<ItemsResponse>(apiUrls("products"), backendCandidates).catch(
      (): ItemsResponse => ({
        data: { items: [] },
      })
    );
    const items = json.data?.items ?? [];
    return items.map((value): Product => {
      const obj = asObject(value) ?? {};
      const parametersValue = obj.parameters;
      const metricsValue = obj.metrics;
      const parameters = Array.isArray(parametersValue)
        ? parametersValue
            .map((p) => asObject(p))
            .filter((p): p is JsonObject => Boolean(p))
            .map((p) => ({ title: asString(p.title, ""), value: asString(p.value, "") }))
        : [];
      const metrics = Array.isArray(metricsValue)
        ? metricsValue
            .map((m) => asObject(m))
            .filter((m): m is JsonObject => Boolean(m))
            .map((m) => ({
              title: asString(m.title, ""),
              firstValue: asNumber(m.firstValue, 0),
              secondValue: asNumber(m.secondValue, 0),
            }))
        : [];
      return {
        productId: asString(obj.productId, ""),
        name: asString(obj.name, ""),
        price: asNumber(obj.price, 0),
        type: asString(obj.type, ""),
        image: asString(obj.image, ""),
        parameters,
        metrics,
        markupRate: obj.markupRate === null ? undefined : asNumber(obj.markupRate, 0),
        profit: obj.profit === null ? undefined : asNumber(obj.profit, 0),
      };
    });
  }
  if (pageName === "events") {
    const json = await fetchWithHeal<ItemsResponse>(apiUrls("events"), backendCandidates).catch(
      (): ItemsResponse => ({
        data: { items: [] },
      })
    );
    const items = json.data?.items ?? [];
    return items.map((value): CalendarEvent => {
      const obj = asObject(value) ?? {};
      const start = obj.start;
      const end = obj.end;
      return {
        id: asString(obj.id, ""),
        title: asString(obj.title, ""),
        start: start === null || start === undefined ? undefined : asString(start, ""),
        end: end === null || end === undefined ? undefined : asString(end, ""),
      };
    });
  }
  throw new Error(`Unsupported page data request: ${pageName}`);
}
