import type { DatasetColumn, RoleMap } from "../../../types/engine";

type Deps = {
  clamp: (value: number, min?: number, max?: number) => number;
  ratio: (num: number, den: number) => number;
};

export const buildNormalizationArtifacts = (columns: DatasetColumn[]) => {
  const normalizationApplied: Record<string, string[]> = {};
  const parseFailures: Record<string, { failedCount: number; examples: string[] }> =
    {};
  columns.forEach((column) => {
    const transformations: string[] = [];
    if (column.inferredType === "datetime") {
      transformations.push("datetime_to_utc_timestamp");
    }
    if (column.inferredType === "numerical") {
      transformations.push("currency_to_numeric");
    }
    if (column.inferredType === "boolean") {
      transformations.push("boolean_unification");
    }
    if (column.inferredType === "categorical") {
      transformations.push("trim_lowercase");
    }
    if (column.inferredType === "text") {
      transformations.push("trim");
    }
    normalizationApplied[column.name] = transformations;
    const parseRatio =
      column.inferredType === "datetime"
        ? column.parseRatios.datetime
        : column.inferredType === "numerical"
        ? column.parseRatios.numeric
        : column.inferredType === "boolean"
        ? column.parseRatios.boolean
        : 1;
    parseFailures[column.name] = {
      failedCount: Math.max(0, Math.round((1 - parseRatio) * 1000)),
      examples: [],
    };
  });
  return {
    normalizationApplied,
    parseFailures,
  };
};

export const buildQuality = (columns: DatasetColumn[], roles: RoleMap, deps: Deps) => {
  const warnings: string[] = [];
  const missingRatio =
    columns.reduce((sum, column) => sum + column.nullRate, 0) /
    Math.max(1, columns.length);
  if (missingRatio > 0.35) {
    warnings.push("High overall missing values across columns");
  }
  const parseSignals = columns.map(
    (column) =>
      Math.max(
        column.parseRatios.numeric,
        column.parseRatios.datetime,
        column.parseRatios.boolean
      ) || 0
  );
  const avgParse =
    parseSignals.reduce((sum, value) => sum + value, 0) / Math.max(1, parseSignals.length);
  if (avgParse < 0.65) {
    warnings.push("Low parsing success on multiple columns");
  }
  const selectedRoleConfidences = Object.values(roles)
    .filter((role) => role.column)
    .map((role) => role.confidence);
  const avgRoleConfidence =
    selectedRoleConfidences.reduce((sum, value) => sum + value, 0) /
    Math.max(1, selectedRoleConfidences.length);
  if (avgRoleConfidence < 0.75) {
    warnings.push("Role confidence is moderate; validate inferred mappings");
  }
  const usableColumns = columns.filter(
    (column) => column.inferredType !== "text" || column.uniqueRatio < 0.95
  ).length;
  const usableRatio = deps.ratio(usableColumns, columns.length);
  const qualityScore = deps.clamp(
    0.35 * (1 - missingRatio) +
      0.25 * usableRatio +
      0.25 * avgRoleConfidence +
      0.15 * avgParse
  );
  return {
    quality_score: Number(qualityScore.toFixed(2)),
    warnings,
  };
};
