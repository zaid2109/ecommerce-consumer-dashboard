import type { DatasetMetadata, FilterInput, BuiltFilters } from "../../../types/engine";

type Deps = {
  toIdentifier: (value: string) => string;
};

export const buildFilterClause = (dataset: DatasetMetadata, filters: FilterInput, deps: Deps): BuiltFilters => {
  const clauses: string[] = [];
  const params: Array<string | number | boolean> = [];
  const unapplied: string[] = [];
  const timestampColumn = dataset.roles.timestamp?.column;
  const categoryColumn = dataset.roles.category?.column;
  const paymentMethodColumn = dataset.roles.payment_method?.column;

  if (filters.from || filters.to) {
    if (!timestampColumn) {
      unapplied.push("date_range");
    } else {
      if (filters.from) {
        clauses.push(`${deps.toIdentifier(timestampColumn)} >= ?::TIMESTAMP`);
        params.push(filters.from);
      }
      if (filters.to) {
        clauses.push(`${deps.toIdentifier(timestampColumn)} <= ?::TIMESTAMP`);
        params.push(filters.to);
      }
    }
  }
  if (filters.category) {
    if (!categoryColumn) {
      unapplied.push("category");
    } else {
      clauses.push(`${deps.toIdentifier(categoryColumn)} = ?`);
      params.push(filters.category.trim().toLowerCase());
    }
  }
  if (filters.paymentMethod) {
    if (!paymentMethodColumn) {
      unapplied.push("payment_method");
    } else {
      clauses.push(`${deps.toIdentifier(paymentMethodColumn)} = ?`);
      params.push(filters.paymentMethod.trim().toLowerCase());
    }
  }
  return {
    whereSql: clauses.length ? `where ${clauses.join(" and ")}` : "",
    params,
    unapplied,
  };
};
