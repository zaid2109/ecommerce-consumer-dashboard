import type { ColumnType, DatasetColumn } from "../../../types/engine";

type RunFn = (sql: string) => Promise<void>;

type Deps = {
  toIdentifier: (value: string) => string;
  run: RunFn;
};

export const parseTimestampExpr = (identifier: string) =>
  `coalesce(
    try_cast(${identifier} as TIMESTAMP),
    try_strptime(${identifier}, '%Y-%m-%d'),
    try_strptime(${identifier}, '%Y/%m/%d'),
    try_strptime(${identifier}, '%d-%m-%Y'),
    try_strptime(${identifier}, '%d/%m/%Y'),
    try_strptime(${identifier}, '%m/%d/%Y'),
    try_strptime(${identifier}, '%Y-%m-%d %H:%M:%S'),
    try_strptime(${identifier}, '%Y/%m/%d %H:%M:%S'),
    try_strptime(${identifier}, '%d-%m-%Y %H:%M:%S'),
    try_strptime(${identifier}, '%d/%m/%Y %H:%M:%S'),
    try_strptime(${identifier}, '%m/%d/%Y %H:%M:%S'),
    try_strptime(${identifier}, '%Y-%m-%dT%H:%M:%S'),
    try_strptime(${identifier}, '%Y-%m-%dT%H:%M:%S.%f%z'),
    try_strptime(${identifier}, '%Y-%m-%dT%H:%M:%S%z')
  )`;

export const normalizeMoneyExpr = (identifier: string) => {
  const stripped = `regexp_replace(trim(coalesce(${identifier}, '')), '[^0-9,\\.\\-\\(\\)]', '', 'g')`;
  const unified = `replace(${stripped}, ',', '')`;
  return `case
    when trim(coalesce(${identifier}, '')) = '' then null
    when regexp_matches(${unified}, '^\\(.*\\)$') then try_cast(concat('-', regexp_replace(${unified}, '[\\(\\)]', '', 'g')) as DOUBLE)
    else try_cast(${unified} as DOUBLE)
  end`;
};

export const normalizeBooleanExpr = (identifier: string) => `case
  when lower(trim(coalesce(${identifier}, ''))) in ('true','t','1','yes','y') then true
  when lower(trim(coalesce(${identifier}, ''))) in ('false','f','0','no','n') then false
  else null
end`;

export const getTypeExpression = (
  columnName: string,
  inferredType: ColumnType,
  deps: Pick<Deps, "toIdentifier">
) => {
  const identifier = deps.toIdentifier(columnName);
  if (inferredType === "numerical") {
    return normalizeMoneyExpr(identifier);
  }
  if (inferredType === "datetime") {
    return parseTimestampExpr(identifier);
  }
  if (inferredType === "boolean") {
    return normalizeBooleanExpr(identifier);
  }
  if (inferredType === "categorical") {
    return `nullif(lower(trim(${identifier})), '')`;
  }
  return `nullif(trim(${identifier}), '')`;
};

export const createCleanTable = async (
  cleanTable: string,
  rawTable: string,
  columns: DatasetColumn[],
  deps: Deps
) => {
  const projections = columns
    .map((column) => {
      const expression = getTypeExpression(column.name, column.inferredType, deps);
      return `${expression} as ${deps.toIdentifier(column.name)}`;
    })
    .join(", ");
  const sql = `create or replace table ${deps.toIdentifier(cleanTable)} as select ${projections} from ${deps.toIdentifier(rawTable)}`;
  await deps.run(sql);
};
