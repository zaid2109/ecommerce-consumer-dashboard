import type { DatasetMetadata, FilterInput } from "../../../types/engine";

type BuiltFilters = {
  whereSql: string;
  params: Array<string | number | boolean>;
  unapplied: string[];
};

type Deps = {
  ensureStorage: () => void;
  dbFilePath: string;
  duckdbModule: unknown;
  toIdentifier: (value: string) => string;
};

export type DbPrimitive = string | number | boolean | null;
export type DbRow = Record<string, DbPrimitive>;

type DuckDbModule = {
  Database: new (filePath: string) => DuckDbDatabase;
};

type DuckDbConnection = {
  run: (
    sql: string,
    ...args: Array<
      string | number | boolean | ((error: Error | null) => void)
    >
  ) => void;
  all: <T = DbRow>(
    sql: string,
    ...args: Array<
      | string
      | number
      | boolean
      | ((error: Error | null, rows: T[]) => void)
    >
  ) => void;
};

type DuckDbDatabase = {
  run: (
    sql: string,
    ...args: Array<
      string | number | boolean | ((error: Error | null) => void)
    >
  ) => void;
  all: <T = DbRow>(
    sql: string,
    ...args: Array<
      | string
      | number
      | boolean
      | ((error: Error | null, rows: T[]) => void)
    >
  ) => void;
};

type RunCallback = (error: Error | null) => void;
type AllCallback<T> = (error: Error | null, rows: T[]) => void;

let dbInstance: DuckDbDatabase | null = null;
let dbOperationQueue: Promise<void> = Promise.resolve();

const isDuckDbModule = (value: object): value is DuckDbModule => {
  if (!("Database" in value)) {
    return false;
  }
  const maybeDb = (value as Record<string, Function>)["Database"];
  return typeof maybeDb === "function";
};

export const resetDbConnection = () => {
  dbInstance = null;
};

export const shouldReconnect = (error: Error) =>
  /Connection was never established|has been closed already/i.test(error.message);

export const getDbConnection = (deps: Deps) => {
  if (dbInstance) {
    return dbInstance;
  }
  deps.ensureStorage();
  if (typeof deps.duckdbModule !== "object" || deps.duckdbModule === null || !isDuckDbModule(deps.duckdbModule)) {
    throw new Error("DuckDB module is unavailable");
  }
  dbInstance = new deps.duckdbModule.Database(deps.dbFilePath);
  return dbInstance;
};

export const runWithParams = (
  connection: DuckDbConnection,
  sql: string,
  params: Array<string | number | boolean>,
  callback: RunCallback
) => {
  if (params.length === 0) {
    connection.run(sql, callback);
    return;
  }
  connection.run(sql, ...params, callback);
};

export const allWithParams = <T>(
  connection: DuckDbConnection,
  sql: string,
  params: Array<string | number | boolean>,
  callback: AllCallback<T>
) => {
  if (params.length === 0) {
    connection.all<T>(sql, callback);
    return;
  }
  connection.all<T>(sql, ...params, callback);
};

export const enqueueDbOperation = <T>(operation: () => Promise<T>) => {
  const queuedOperation = dbOperationQueue.then(operation, operation);
  dbOperationQueue = queuedOperation.then(
    () => undefined,
    () => undefined
  );
  return queuedOperation;
};

export const runDirect = (
  deps: Deps,
  sql: string,
  params: Array<string | number | boolean> = [],
  retryCount = 1
) =>
  new Promise<void>((resolve, reject) => {
    const connection = getDbConnection(deps);
    runWithParams(connection, sql, params, async (error: Error | null) => {
      if (error) {
        if (retryCount > 0 && shouldReconnect(error)) {
          resetDbConnection();
          try {
            await runDirect(deps, sql, params, retryCount - 1);
            resolve();
            return;
          } catch (retryError) {
            reject(retryError);
            return;
          }
        }
        reject(error);
        return;
      }
      resolve();
    });
  });

export const allDirect = <T = DbRow>(
  deps: Deps,
  sql: string,
  params: Array<string | number | boolean> = [],
  retryCount = 1
) =>
  new Promise<T[]>((resolve, reject) => {
    const connection = getDbConnection(deps);
    allWithParams<T>(connection, sql, params, (error: Error | null, rows: T[]) => {
      if (error) {
        if (retryCount > 0 && shouldReconnect(error)) {
          resetDbConnection();
          allDirect<T>(deps, sql, params, retryCount - 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

export const run = (deps: Deps, sql: string, params: Array<string | number | boolean> = []) =>
  enqueueDbOperation(() => runDirect(deps, sql, params));

export const all = <T = DbRow>(deps: Deps, sql: string, params: Array<string | number | boolean> = []) =>
  enqueueDbOperation(() => allDirect<T>(deps, sql, params));

export const ensureDatasetTables = async (deps: Deps, dataset: DatasetMetadata) =>
  run(deps, `select 1 from ${deps.toIdentifier(dataset.tables.clean)} limit 1`);

export const buildFilterClause = (dataset: DatasetMetadata, filters: FilterInput, deps: Deps): BuiltFilters => {
  const conditions: string[] = [];
  const params: Array<string | number | boolean> = [];
  const unapplied: string[] = [];

  if (filters.from) {
    const timestampCol = dataset.roles.timestamp?.column;
    if (timestampCol) {
      conditions.push(`${deps.toIdentifier(timestampCol)} >= ?`);
      params.push(filters.from);
    } else {
      unapplied.push("from");
    }
  }

  if (filters.to) {
    const timestampCol = dataset.roles.timestamp?.column;
    if (timestampCol) {
      conditions.push(`${deps.toIdentifier(timestampCol)} <= ?`);
      params.push(filters.to);
    } else {
      unapplied.push("to");
    }
  }

  if (filters.category) {
    const categoryCol = dataset.roles.category?.column;
    if (categoryCol) {
      conditions.push(`${deps.toIdentifier(categoryCol)} = ?`);
      params.push(filters.category);
    } else {
      unapplied.push("category");
    }
  }

  if (filters.paymentMethod) {
    const paymentMethodCol = dataset.roles.payment_method?.column;
    if (paymentMethodCol) {
      conditions.push(`${deps.toIdentifier(paymentMethodCol)} = ?`);
      params.push(filters.paymentMethod);
    } else {
      unapplied.push("paymentMethod");
    }
  }

  const whereSql = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  return { whereSql, params, unapplied };
};

export const hasUsableRows = async (deps: Deps, dataset: DatasetMetadata, whereSql: string, params: Array<string | number | boolean>) => {
  const [row] = await all<{ count: number }>(
    deps,
    `select count(*) as count from ${deps.toIdentifier(dataset.tables.clean)} ${whereSql}`,
    params
  );
  return Number(row?.count ?? 0);
};

export const truthyStatusExpression = (columnName: string) =>
  `case when lower(cast(${columnName} as varchar)) in ('true','t','1','yes','y','success','succeeded','paid','completed','returned','refund','refunded') then 1 else 0 end`;

export const falsyStatusExpression = (columnName: string) =>
  `case when lower(cast(${columnName} as varchar)) in ('false','f','0','no','n','failed','failure','declined','cancelled','canceled') then 1 else 0 end`;

export const withQueryTiming = async <T>(queryName: string, fn: () => Promise<T>) => {
  const started = Date.now();
  const result = await fn();
  if (process.env.DEBUG === "true") {
    console.log(
      JSON.stringify({
        queryName,
        durationMs: Date.now() - started,
      })
    );
  }
  return result;
};
