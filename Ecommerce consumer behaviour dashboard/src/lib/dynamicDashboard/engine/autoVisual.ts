import type { DashboardModule, DatasetMetadata, FilterInput } from "../../../types/engine";

type DbPrimitive = string | number | boolean | null;

type BuiltFilters = {
  whereSql: string;
  params: Array<string | number | boolean>;
  unapplied: string[];
};

type AutoModuleOk = {
  id: string;
  title: string;
  status: "ok";
  data: Record<string, unknown>;
  meta: {
    unappliedFilters: string[];
  };
};

type AutoModuleUnavailable = {
  id: string;
  title: string;
  status: "unavailable";
  reason: string;
  required: string[];
  detected: Record<string, string | null>;
};

type AutoModuleError = {
  id: string;
  title: string;
  status: "error";
  reason: string;
  errorId: string;
};

type AutoModule = AutoModuleOk | AutoModuleUnavailable | AutoModuleError;

type Deps = {
  buildFilterClause: (dataset: DatasetMetadata, filters: FilterInput) => BuiltFilters;
  toIdentifier: (value: string) => string;
  withQueryTiming: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  all: <T>(sql: string, params?: Array<string | number | boolean>) => Promise<T[]>;
};

export const getAutoVisualModules = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  deps: Deps
): Promise<DashboardModule[]> => {
  const filter = deps.buildFilterClause(dataset, filters);
  const numericColumns = dataset.schema
    .filter((column) => column.inferredType === "numerical" && column.nullRate < 0.95)
    .map((column) => column.name);
  const categoricalColumns = dataset.schema
    .filter((column) => column.inferredType === "categorical" && column.nullRate < 0.95)
    .map((column) => column.name);
  const datetimeColumns = dataset.schema
    .filter((column) => column.inferredType === "datetime" && column.nullRate < 0.98)
    .map((column) => column.name);
  const timestampColumn = dataset.roles.timestamp?.column ?? datetimeColumns[0] ?? null;
  const autoModules: AutoModule[] = [];

  if (timestampColumn) {
    for (const numericColumn of numericColumns.slice(0, 2)) {
      const scopedWhere = filter.whereSql
        ? `${filter.whereSql} and ${deps.toIdentifier(timestampColumn)} is not null and ${deps.toIdentifier(numericColumn)} is not null`
        : `where ${deps.toIdentifier(timestampColumn)} is not null and ${deps.toIdentifier(numericColumn)} is not null`;
      const rows = await deps.withQueryTiming(`auto_time_${numericColumn}`, () =>
        deps.all<{ bucket: string; value: number }>(
          `
            select
              strftime(date_trunc('day', ${deps.toIdentifier(timestampColumn)}), '%Y-%m-%d') as bucket,
              coalesce(sum(${deps.toIdentifier(numericColumn)}), 0) as value
            from ${deps.toIdentifier(dataset.tables.clean)}
            ${scopedWhere}
            group by 1
            order by 1
            limit 180
          `,
          filter.params
        )
      );
      autoModules.push(
        rows.length
          ? ({
              id: `auto-time-${numericColumn}`,
              title: `${numericColumn} over time`,
              status: "ok",
              data: {
                chartType: "line",
                xKey: "bucket",
                yKey: "value",
                data: rows.map((row) => ({
                  bucket: row.bucket,
                  value: Number(row.value),
                })),
              },
              meta: {
                unappliedFilters: filter.unapplied,
              },
            } satisfies AutoModuleOk)
          : ({
              id: `auto-time-${numericColumn}`,
              title: `${numericColumn} over time`,
              status: "unavailable",
              reason: "No data for selected filters",
              required: [numericColumn],
              detected: { [numericColumn]: numericColumn },
            } satisfies AutoModuleUnavailable)
      );
    }
  }

  for (const categoricalColumn of categoricalColumns.slice(0, 2)) {
    const firstNumericColumn = numericColumns[0] ?? null;
    const scopedWhere = filter.whereSql
      ? `${filter.whereSql} and ${deps.toIdentifier(categoricalColumn)} is not null`
      : `where ${deps.toIdentifier(categoricalColumn)} is not null`;
    const aggregateExpression = firstNumericColumn
      ? `coalesce(sum(${deps.toIdentifier(firstNumericColumn)}), 0)`
      : "count(*)";
    const rows = await deps.withQueryTiming(`auto_bar_${categoricalColumn}`, () =>
      deps.all<{ label: DbPrimitive; value: number }>(
        `
          select
            ${deps.toIdentifier(categoricalColumn)} as label,
            ${aggregateExpression} as value
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${scopedWhere}
          group by 1
          order by 2 desc
          limit 12
        `,
        filter.params
      )
    );
    autoModules.push(
      rows.length
        ? ({
            id: `auto-bar-${categoricalColumn}`,
            title: firstNumericColumn
              ? `${firstNumericColumn} by ${categoricalColumn}`
              : `Distribution by ${categoricalColumn}`,
            status: "ok",
            data: {
              chartType: "bar",
              xKey: "label",
              yKey: "value",
              data: rows.map((row) => ({
                label: row.label,
                value: Number(row.value),
              })),
            },
            meta: {
              unappliedFilters: filter.unapplied,
            },
          } satisfies AutoModuleOk)
        : ({
            id: `auto-bar-${categoricalColumn}`,
            title: `${categoricalColumn} breakdown`,
            status: "unavailable",
            reason: "No data for selected filters",
            required: [categoricalColumn],
            detected: { [categoricalColumn]: categoricalColumn },
          } satisfies AutoModuleUnavailable)
    );
  }

  const pieColumn = dataset.schema.find(
    (column) =>
      column.inferredType === "categorical" &&
      column.uniqueRatio > 0 &&
      column.uniqueRatio <= 0.25 &&
      column.nullRate < 0.95
  )?.name;
  if (pieColumn) {
    const scopedWhere = filter.whereSql
      ? `${filter.whereSql} and ${deps.toIdentifier(pieColumn)} is not null`
      : `where ${deps.toIdentifier(pieColumn)} is not null`;
    const rows = await deps.withQueryTiming(`auto_pie_${pieColumn}`, () =>
      deps.all<{ label: DbPrimitive; value: number }>(
        `
          select
            ${deps.toIdentifier(pieColumn)} as label,
            count(*) as value
          from ${deps.toIdentifier(dataset.tables.clean)}
          ${scopedWhere}
          group by 1
          order by 2 desc
          limit 8
        `,
        filter.params
      )
    );
    autoModules.push(
      rows.length
        ? ({
            id: `auto-pie-${pieColumn}`,
            title: `${pieColumn} share`,
            status: "ok",
            data: {
              chartType: "pie",
              nameKey: "label",
              valueKey: "value",
              data: rows.map((row) => ({
                label: row.label,
                value: Number(row.value),
              })),
            },
            meta: {
              unappliedFilters: filter.unapplied,
            },
          } satisfies AutoModuleOk)
        : ({
            id: `auto-pie-${pieColumn}`,
            title: `${pieColumn} share`,
            status: "unavailable",
            reason: "No data for selected filters",
            required: [pieColumn],
            detected: { [pieColumn]: pieColumn },
          } satisfies AutoModuleUnavailable)
    );
  }

  return autoModules as DashboardModule[];
};
