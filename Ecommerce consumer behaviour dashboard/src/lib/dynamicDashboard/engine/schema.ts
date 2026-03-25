import type { ColumnType, DatasetColumn } from "../../../types/engine";

type DbPrimitive = string | number | boolean | null;
type DbRow = Record<string, DbPrimitive>;

type AllFn = <T = DbRow>(sql: string) => Promise<T[]>;

type GetColumnNamesDeps = {
  all: AllFn;
  toSqlString: (value: string) => string;
};

type ColumnStatsDeps = {
  all: AllFn;
  toIdentifier: (value: string) => string;
  ratio: (num: number, den: number) => number;
  normalizeMoneyExpr: (identifier: string) => string;
  parseTimestampExpr: (identifier: string) => string;
  normalizeBooleanExpr: (identifier: string) => string;
};

export const getColumnNames = async (
  tableName: string,
  deps: GetColumnNamesDeps
): Promise<string[]> => {
  const rows = await deps.all<{ name: string }>(
    `select name from pragma_table_info(${deps.toSqlString(tableName)})`
  );
  return rows.map((row) => row.name);
};

export const columnStats = async (
  rawTable: string,
  columnName: string,
  deps: ColumnStatsDeps
): Promise<DatasetColumn> => {
  const col = deps.toIdentifier(columnName);
  const statsSql = `
    select
      count(*) as total_rows,
      sum(case when trim(coalesce(${col}, '')) = '' then 1 else 0 end) as missing_rows,
      sum(case when ${deps.normalizeMoneyExpr(col)} is not null then 1 else 0 end) as parsed_numeric,
      sum(case when ${deps.parseTimestampExpr(col)} is not null then 1 else 0 end) as parsed_datetime,
      sum(case when ${deps.normalizeBooleanExpr(col)} is not null then 1 else 0 end) as parsed_boolean,
      approx_count_distinct(${col}) as unique_count
    from ${deps.toIdentifier(rawTable)}
  `;
  const [stats] = await deps.all<{
    total_rows: number;
    missing_rows: number;
    parsed_numeric: number;
    parsed_datetime: number;
    parsed_boolean: number;
    unique_count: number;
  }>(statsSql);

  const totalRows = Number(stats?.total_rows ?? 0);
  const missingRows = Number(stats?.missing_rows ?? 0);
  const nonMissing = Math.max(0, totalRows - missingRows);
  const parsedNumeric = Number(stats?.parsed_numeric ?? 0);
  const parsedDatetime = Number(stats?.parsed_datetime ?? 0);
  const parsedBoolean = Number(stats?.parsed_boolean ?? 0);
  const uniqueCount = Number(stats?.unique_count ?? 0);

  const numericRatio = deps.ratio(parsedNumeric, nonMissing);
  const datetimeRatio = deps.ratio(parsedDatetime, nonMissing);
  const booleanRatio = deps.ratio(parsedBoolean, nonMissing);
  const uniqueRatio = deps.ratio(uniqueCount, nonMissing);

  let inferredType: ColumnType = "text";
  if (booleanRatio >= 0.9) {
    inferredType = "boolean";
  } else if (datetimeRatio >= 0.75) {
    inferredType = "datetime";
  } else if (numericRatio >= 0.85) {
    inferredType = "numerical";
  } else if (uniqueRatio <= 0.2) {
    inferredType = "categorical";
  }
  if (inferredType === "categorical" && uniqueRatio > 0.6) {
    inferredType = "text";
  }

  const topValues = await deps.all<{ value: string; count: number }>(
    `
      select lower(trim(${col})) as value, count(*) as count
      from ${deps.toIdentifier(rawTable)}
      where trim(coalesce(${col}, '')) <> ''
      group by 1
      order by 2 desc
      limit 5
    `
  );

  return {
    name: columnName,
    inferredType,
    nullRate: deps.ratio(missingRows, totalRows),
    uniqueRatio,
    parseRatios: {
      numeric: numericRatio,
      datetime: datetimeRatio,
      boolean: booleanRatio,
    },
    topValues: topValues.map((item) => ({
      value: item.value,
      count: Number(item.count),
    })),
  };
};
