// Global type definitions for the application

export {};

declare global {
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

interface ColumnMeta {
  name: string;
  inferredType: 'numerical' | 'text' | 'datetime' | 'boolean';
  nullRate: number;
  uniqueRatio?: number;
  parseRatios?: {
    numeric: number;
    datetime: number;
    boolean: number;
  };
  topValues?: Array<{
    value: string | number;
    count: number;
  }>;
}

interface RoleMap {
  [roleName: string]: {
    column: string | null;
    confidence: number;
    candidates: Array<{
      column: string;
      confidence: number;
      nullRate: number;
    }>;
    reasoning?: string;
  };
}

interface DatasetSchema {
  columns: string[];
  schema: ColumnMeta[];
  roles: RoleMap;
}

interface DatasetMetadata {
  datasetId: string;
  datasetKey: string;
  versionId: string;
  createdAt: string;
  sourceFileName: string;
  sourceFilePath: string;
  rowCount: number;
  columns: string[];
  schema: ColumnMeta[];
  roles: RoleMap;
  profile?: {
    rowCount: number;
    columnCount: number;
  };
  modules?: {
    [moduleName: string]: {
      enabled: boolean;
    };
  };
}

interface ModuleResult<T = JsonValue> {
  status: 'ok' | 'unavailable' | 'error';
  data?: T;
  reason?: string;
  errorId?: string;
}

interface DashboardModule {
  id: string;
  status: 'ok' | 'unavailable' | 'error';
  data?: JsonValue;
  reason?: string;
  errorId?: string;
}

interface DashboardResponse {
  modules: DashboardModule[];
  data?: {
    [moduleName: string]: ModuleResult;
  };
}

interface FilterInput {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  paymentMethod?: string;
  granularity?: 'day' | 'week' | 'month';
}

interface PurchaseFrequencyData {
  avg_orders_per_customer?: number;
  repeat_rate?: number;
  active_customers?: number | null;
  avg_purchase_interval?: number | null;
  orders_over_time?: Array<{
    date?: string;
    bucket?: string;
    orders?: number;
    order_count?: number;
  }>;
  orders_distribution?: Array<{
    orders?: number;
    customers?: number;
  }>;
  repeat_vs_onetime?: Array<{
    name?: string;
    value?: number;
  } | {
    segment?: string;
    customers?: number;
  }>;
  customer_table?: Array<{
    customer_id?: string;
    total_orders?: number;
    last_purchase_date?: string | null;
    avg_order_gap?: number | null;
  }>;
}

interface PurchaseFrequencyDashboardPayload {
  status: 'ok' | 'unavailable' | 'error';
  data?: PurchaseFrequencyData;
  reason?: string;
  errorId?: string;
}

interface ApiResponse<T = JsonValue> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

}
