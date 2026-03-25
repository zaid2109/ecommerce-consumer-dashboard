import type { DatasetColumn, DatasetMetadata, DatasetModuleAvailability, ProfileResult, RoleMap } from "../../../types/engine";

type DbPrimitive = string | number | boolean | null;
export type DbRow = Record<string, DbPrimitive>;

type RunFn = (sql: string) => Promise<void>;
type AllFn = <T = DbRow>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;

export type IngestionDeps = {
  ensureStorage: () => void;
  randomId: (prefix: string) => string;
  uploadsDir: string;
  maxFileSizeMb: number;
  maxColumns: number;
  maxFieldLength: number;
  run: (sql: string, params?: Array<string | number | boolean>) => Promise<void>;
  all: <T = DbRow>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
  toIdentifier: (value: string) => string;
  toSqlString: (value: string) => string;
  getColumnNames: (tableName: string) => Promise<string[]>;
  pathExtname: (value: string) => string;
  pathJoin: (...parts: string[]) => string;
  writeFileSync: (filePath: string, data: Buffer) => void;
  columnStats: (rawTable: string, columnName: string) => Promise<DatasetColumn>;
  createCleanTable: (cleanTable: string, rawTable: string, columns: DatasetColumn[]) => Promise<void>;
  inferRoles: (columns: DatasetColumn[]) => RoleMap;
  buildNormalizationArtifacts: (
   columns: DatasetColumn[]
  ) => Pick<ProfileResult, "normalizationApplied" | "parseFailures">;
  buildQuality: (columns: DatasetColumn[], roles: RoleMap) => { quality_score: number; warnings: string[] };
  nowIso: () => string;
  buildModuleAvailability: (roles: RoleMap) => DatasetModuleAvailability;
  persistMetadata: () => void;
  loadMetadata: () => Record<string, DatasetMetadata>;
  clearDatasetCache: (datasetId: string) => void;
};

export type UploadResult = {
  datasetId: string;
  rowCount: number;
  columns: string[];
  preview: DbRow[];
  warnings: string[];
};

export type IngestionResult = {
  datasetId: string;
  datasetKey: string;
  versionId: string;
  filePath: string;
  rawTable: string;
  cleanTable: string;
  columnNames: string[];
  rowCount: number;
};

const validateCsvBasics = async (file: File, maxFileSizeMb: number) => {
  if (!file) {
    throw new Error("Missing file");
  }
  const maxBytes = maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds size limit (${maxFileSizeMb}MB)`);
  }
  const chunk = Buffer.from(await file.slice(0, 1024).arrayBuffer());
  const hasBinaryNull = chunk.includes(0);
  if (hasBinaryNull) {
    throw new Error("Uploaded file appears to be binary");
  }
};

export const ingestDataset = async (file: File, deps: IngestionDeps): Promise<IngestionResult> => {
  await validateCsvBasics(file, deps.maxFileSizeMb);
  deps.ensureStorage();

  const datasetId = deps.randomId("ds");
  const datasetKey = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const versionId = deps.randomId("ver");

  const fileExt = deps.pathExtname(file.name || ".csv") || ".csv";
  const fileName = `${datasetId}${fileExt}`;
  const filePath = deps.pathJoin(deps.uploadsDir, fileName);
  const fileBytes = Buffer.from(await file.arrayBuffer());
  deps.writeFileSync(filePath, fileBytes);

  const rawTable = `raw_${datasetId}`;
  const cleanTable = `clean_${datasetId}`;

  await deps.run(
    `create or replace table ${deps.toIdentifier(rawTable)} as
    select * from read_csv_auto(${deps.toSqlString(filePath)}, header=true, all_varchar=true, ignore_errors=true, max_line_size=${deps.maxFieldLength})`
  );

  const columnNames = await deps.getColumnNames(rawTable);
  if (columnNames.length > deps.maxColumns) {
    await deps.run(`drop table if exists ${deps.toIdentifier(rawTable)}`);
    throw new Error(`CSV exceeds maximum number of columns (${deps.maxColumns})`);
  }

  const [countRow] = await deps.all<{ count: number }>(
    `select count(*) as count from ${deps.toIdentifier(rawTable)}`
  );
  const rowCount = Number(countRow?.count ?? 0);

  return {
    datasetId,
    datasetKey,
    versionId,
    filePath,
    rawTable,
    cleanTable,
    columnNames,
    rowCount,
  };
};

export const processDatasetUpload = async (file: File, deps: IngestionDeps): Promise<UploadResult> => {
  const {
    datasetId,
    datasetKey,
    versionId,
    filePath,
    rawTable,
    cleanTable,
    columnNames,
    rowCount,
  } = await ingestDataset(file, deps);
  
  const schema: DatasetColumn[] = [];
  for (const columnName of columnNames) {
    const stats = await deps.columnStats(rawTable, columnName);
    schema.push(stats);
  }
  
  await deps.createCleanTable(cleanTable, rawTable, schema);
  const roles = deps.inferRoles(schema);
  const { normalizationApplied, parseFailures } = deps.buildNormalizationArtifacts(schema);
  const quality = deps.buildQuality(schema, roles);
  const missingRatio =
    schema.reduce((sum, column) => sum + column.nullRate, 0) /
    Math.max(1, schema.length);
  
  const profile: ProfileResult = {
    rowCount,
    columnCount: columnNames.length,
    missingRatio,
    columns: schema,
    quality,
    normalizationApplied,
    parseFailures,
  };
  
  const metadata: DatasetMetadata = {
    datasetId,
    datasetKey,
    versionId,
    createdAt: deps.nowIso(),
    sourceFileName: file.name,
    sourceFilePath: filePath,
    rowCount,
    columns: columnNames,
    schema,
    roles,
    profile,
    modules: deps.buildModuleAvailability(roles),
    timestampNormalization: "UTC",
    timestampSourceTimezone: null,
    warnings: quality.warnings,
    tables: {
      raw: rawTable,
      clean: cleanTable,
    },
  };
  
  const store = deps.loadMetadata();
  store[datasetId] = metadata;
  deps.persistMetadata();
  deps.clearDatasetCache(datasetId);
  
  const preview = await deps.all<DbRow>(
    `select * from ${deps.toIdentifier(cleanTable)} limit 20`
  );
  
  return {
    datasetId,
    rowCount,
    columns: columnNames,
    preview,
    warnings: metadata.warnings,
  };
};
