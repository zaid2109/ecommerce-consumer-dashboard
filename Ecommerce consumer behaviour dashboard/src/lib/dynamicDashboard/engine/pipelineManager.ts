import type { DatasetMetadata, FilterInput, ModuleConfig, ModuleResult } from "../../../types/engine";
import { resolveModules, type ResolveContext, type ResolverDeps } from "./moduleResolver";
import { ingestDataset, type IngestionDeps, type UploadResult } from "./ingestion";
import { withErrorHandling, PipelineError } from "./errorHandling";

export type PipelineResult = {
  resolvedModules: Array<{ id: string; title: string } & ModuleResult<unknown>>;
};

export type UploadPipelineResult = UploadResult;

export type UploadPipelineStage =
  | "ingest"
  | "schema"
  | "normalize"
  | "roles"
  | "profile"
  | "module-resolve"
  | "persist";

export type DashboardPipelineContext = {
  granularity: "day" | "week" | "month";
  topN: number;
};

export const runUploadPipeline = async (
  file: File,
  deps: IngestionDeps
): Promise<UploadPipelineResult> => {
  return withErrorHandling(async () => {
    // Ordered pipeline stages (explicit by design for auditability)
    const stage: { current: UploadPipelineStage } = { current: "ingest" };

    if (!file) {
      throw new PipelineError("No file provided", "validation");
    }

    stage.current = "ingest";
    const ingest = await ingestDataset(file, deps);

    stage.current = "schema";
    const schema = await Promise.all(
      ingest.columnNames.map((columnName) => deps.columnStats(ingest.rawTable, columnName))
    );

    stage.current = "profile";
    const { normalizationApplied, parseFailures } = deps.buildNormalizationArtifacts(schema);
    const missingRatio =
      schema.reduce((sum, column) => sum + column.nullRate, 0) / Math.max(1, schema.length);

    stage.current = "roles";
    const roles = deps.inferRoles(schema);

    stage.current = "normalize";
    await deps.createCleanTable(ingest.cleanTable, ingest.rawTable, schema);

    stage.current = "module-resolve";
    const modules = deps.buildModuleAvailability(roles);

    const quality = deps.buildQuality(schema, roles);
    const profile = {
      rowCount: ingest.rowCount,
      columnCount: ingest.columnNames.length,
      missingRatio,
      columns: schema,
      quality,
      normalizationApplied,
      parseFailures,
    };

    stage.current = "persist";
    const metadata: DatasetMetadata = {
      datasetId: ingest.datasetId,
      datasetKey: ingest.datasetKey,
      versionId: ingest.versionId,
      createdAt: deps.nowIso(),
      sourceFileName: file.name,
      sourceFilePath: ingest.filePath,
      rowCount: ingest.rowCount,
      columns: ingest.columnNames,
      schema,
      roles,
      profile,
      modules,
      timestampNormalization: "UTC",
      timestampSourceTimezone: null,
      warnings: quality.warnings,
      tables: {
        raw: ingest.rawTable,
        clean: ingest.cleanTable,
      },
    };

    const store = deps.loadMetadata();
    store[ingest.datasetId] = metadata;
    deps.persistMetadata();
    deps.clearDatasetCache(ingest.datasetId);

    const preview = await deps.all(
      `select * from ${deps.toIdentifier(ingest.cleanTable)} limit 20`
    );

    return {
      datasetId: ingest.datasetId,
      rowCount: ingest.rowCount,
      columns: ingest.columnNames,
      preview,
      warnings: metadata.warnings,
    };
  }, "upload pipeline");
};

export const runDashboardPipeline = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  modules: ModuleConfig[],
  context: DashboardPipelineContext,
  deps: ResolverDeps
): Promise<PipelineResult> => {
  return withErrorHandling(async () => {
    // Step 1: Validate dataset
    if (!dataset || dataset.rowCount < 2) {
      throw new PipelineError("Dataset contains insufficient data", "validation");
    }

    // Step 2: Resolve and execute modules
    const resolvedModules = await resolveModules(modules, dataset, filters, context, deps);
    
    return { resolvedModules };
  }, "dashboard pipeline");
};

export const runPipeline = async (
  dataset: DatasetMetadata,
  filters: FilterInput,
  modules: ModuleConfig[],
  context: ResolveContext,
  deps: ResolverDeps
): Promise<PipelineResult> => {
  return runDashboardPipeline(dataset, filters, modules, context as DashboardPipelineContext, deps);
};
