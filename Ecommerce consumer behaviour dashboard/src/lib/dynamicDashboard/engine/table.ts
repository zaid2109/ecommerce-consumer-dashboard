import type { DatasetMetadata, FilterInput } from "../../../types/engine";

type DbPrimitive = string | number | boolean | null;
export type DbRow = Record<string, DbPrimitive>;

type BuiltFilters = {
  whereSql: string;
  params: Array<string | number | boolean>;
  unapplied: string[];
};

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => BuiltFilters;
  toIdentifier: (value: string) => string;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
};

export type TablePageResponse = {
  status: "ok";
  data: {
    columns: string[];
    rows: DbRow[];
    pagination: {
      page: number;
      pageSize: number;
      totalRows: number;
    };
  };
  meta: {
    unappliedFilters: string[];
  };
};

export const getTablePage = async (
  dataset: DatasetMetadata,
  page: number,
  limit: number,
  filters: FilterInput,
  deps: Deps
): Promise<TablePageResponse> => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const offset = (safePage - 1) * safeLimit;
  const filter = deps.buildFilterClause(dataset, filters);
  const rows = await deps.all<DbRow>(
    `select * from ${deps.toIdentifier(dataset.tables.clean)} ${filter.whereSql} limit ${safeLimit} offset ${offset}`,
    filter.params
  );
  const [countRow] = await deps.all<{ total: number }>(
    `select count(*) as total from ${deps.toIdentifier(dataset.tables.clean)} ${filter.whereSql}`,
    filter.params
  );
  return {
    status: "ok",
    data: {
      columns: dataset.columns,
      rows,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        totalRows: Number(countRow?.total ?? 0),
      },
    },
    meta: {
      unappliedFilters: filter.unapplied,
    },
  };
};

export const getUniqueValues = async (
  dataset: DatasetMetadata,
  roleKey: string,
  deps: Pick<Deps, "toIdentifier" | "all">
): Promise<string[]> => {
  const columnName = dataset.roles[roleKey]?.column;
  if (!columnName) {
    return [];
  }
  const values = await deps.all<{ value: string }>(
    `
      select ${deps.toIdentifier(columnName)} as value
      from ${deps.toIdentifier(dataset.tables.clean)}
      where ${deps.toIdentifier(columnName)} is not null
      group by 1
      order by count(*) desc
      limit 100
    `
  );
  return values.map((item) => item.value);
};
