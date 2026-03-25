export type ModuleOk<T> = {
  status: "ok";
  data: T;
  meta?: JsonObject;
};

export type ModuleUnavailable = {
  status: "unavailable";
  reason: string;
  required: string[];
  detected: Record<string, string | null>;
  meta?: JsonObject;
};

export type ModuleError = {
  status: "error";
  reason: string;
  errorId: string;
};

export type ModuleResult<T> = ModuleOk<T> | ModuleUnavailable | ModuleError;

export type ColumnType = "numerical" | "categorical" | "datetime" | "boolean" | "text";

export type DatasetColumn = {
  name: string;
  inferredType: ColumnType;
  nullRate: number;
  uniqueRatio: number;
  parseRatios: {
    numeric: number;
    datetime: number;
    boolean: number;
  };
  topValues: { value: string; count: number }[];
};

export type RoleCandidate = {
  column: string;
  confidence: number;
  nullRate: number;
};

export type RoleSelection = {
  column: string | null;
  confidence: number;
  candidates: RoleCandidate[];
  reasoning: string;
};

export type RoleMap = Record<string, RoleSelection>;

export type ProfileResult = {
  rowCount: number;
  columnCount: number;
  missingRatio: number;
  columns: DatasetColumn[];
  quality: {
    quality_score: number;
    warnings: string[];
  };
  normalizationApplied: Record<string, string[]>;
  parseFailures: Record<string, { failedCount: number; examples: string[] }>;
};

export type DatasetSchema = DatasetColumn[];

export type DatasetModuleAvailability = Record<
  string,
  {
    enabled: boolean;
    required: string[];
    detected: Record<string, string | null>;
  }
>;

export type DatasetMetadata = {
  datasetId: string;
  datasetKey: string;
  versionId: string;
  createdAt: string;
  sourceFileName: string;
  sourceFilePath: string;
  rowCount: number;
  columns: string[];
  schema: DatasetSchema;
  roles: RoleMap;
  profile: ProfileResult;
  modules: DatasetModuleAvailability;
  timestampNormalization: "UTC";
  timestampSourceTimezone: string | null;
  warnings: string[];
  tables: {
    raw: string;
    clean: string;
  };
};

export type RawDataset = {
  datasetId: string;
  rawTable: string;
  cleanTable: string;
  sourceFilePath: string;
};

export type NormalizedDataset = {
  datasetId: string;
  table: string;
};

export type QueryObject = {
  sql: string;
  params: Array<string | number | boolean>;
};

export type ModuleConfig = {
  id: string;
  title: string;
  enabled: boolean;
};

export type FilterInput = {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
};

export type BuiltFilters = {
  whereSql: string;
  params: Array<string | number | boolean>;
  unapplied: string[];
};

export type DashboardModule = {
  id: string;
  title: string;
} & ModuleResult<unknown>;

export type DashboardResponse = {
  status: "ok";
  data: {
    datasetId: string;
    schema: DatasetSchema;
    profile: ProfileResult;
    roles: RoleMap;
    timestampNormalization: "UTC";
    timestampSourceTimezone: string | null;
    filterOptions: {
      category: string[];
      paymentMethod: string[];
    };
    modules: DashboardModule[];
  };
};

export type BuildDashboardResult = DashboardResponse;
