import type { DatasetMetadata, DatasetModuleAvailability, DatasetSchema, RoleMap } from "../../../types/engine";

type Deps = {
  ensureStorage: () => void;
  metaFilePath: string;
  readFileSync: (path: string, encoding: "utf-8") => string;
  writeFileSync: (path: string, content: string, encoding: "utf-8") => void;
  existsSync: (path: string) => boolean;
  unlinkSync: (path: string) => void;
  inferRoles: (schema: DatasetSchema) => RoleMap;
  buildModuleAvailability: (roles: RoleMap) => DatasetModuleAvailability;
  clearDatasetCache: (datasetId: string) => void;
};

let metadataStore: Record<string, DatasetMetadata> | null = null;

let injectedDeps: Deps | null = null;

export const setDatasetStoreDeps = (deps: Deps) => {
  injectedDeps = deps;
};

const getInjectedDeps = () => {
  if (!injectedDeps) {
    throw new Error("Dataset store dependencies have not been initialized");
  }
  return injectedDeps;
};

export const loadMetadata = (deps: Deps) => {
  if (metadataStore) {
    return metadataStore;
  }
  deps.ensureStorage();
  const raw = deps.readFileSync(deps.metaFilePath, "utf-8");
  metadataStore = JSON.parse(raw || "{}") as Record<string, DatasetMetadata>;
  return metadataStore;
};

export const persistMetadata = (deps: Deps) => {
  if (!metadataStore) {
    return;
  }
  deps.writeFileSync(deps.metaFilePath, JSON.stringify(metadataStore, null, 2), "utf-8");
};

export const refreshRolesIfNeeded = (dataset: DatasetMetadata, deps: Deps) => {
  const criticalRoles = ["timestamp", "revenue", "customer_id", "product_id"];
  const needsRefresh = criticalRoles.some((role) => !dataset.roles?.[role]?.column);
  if (!needsRefresh) {
    return dataset;
  }
  const refreshedRoles = deps.inferRoles(dataset.schema);
  dataset.roles = refreshedRoles;
  dataset.modules = deps.buildModuleAvailability(refreshedRoles);
  persistMetadata(deps);
  deps.clearDatasetCache(dataset.datasetId);
  return dataset;
};

export const getDatasetWithDeps = (datasetId: string, deps: Deps) => {
  const store = loadMetadata(deps);
  const dataset = store[datasetId] ?? null;
  if (!dataset) {
    return null;
  }
  return refreshRolesIfNeeded(dataset, deps);
};

export const setDatasetWithDeps = (dataset: DatasetMetadata, deps: Deps) => {
  const store = loadMetadata(deps);
  store[dataset.datasetId] = dataset;
  persistMetadata(deps);
};

export const listDatasetsWithDeps = (deps: Deps) => {
  const store = loadMetadata(deps);
  return Object.values(store)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((dataset) => ({
      datasetId: dataset.datasetId,
      datasetKey: dataset.datasetKey,
      versionId: dataset.versionId,
      createdAt: dataset.createdAt,
      rowCount: dataset.rowCount,
      columns: dataset.columns.length,
      sourceFileName: dataset.sourceFileName,
      quality: dataset.profile.quality,
    }));
};

export const deleteDatasetFromStore = (datasetId: string, deps: Deps) => {
  const store = loadMetadata(deps);
  const dataset = store[datasetId];
  if (!dataset) {
    return null;
  }
  if (deps.existsSync(dataset.sourceFilePath)) {
    deps.unlinkSync(dataset.sourceFilePath);
  }
  delete store[datasetId];
  persistMetadata(deps);
  deps.clearDatasetCache(datasetId);
  return dataset;
};

export const loadMetadataStore = () => loadMetadata(getInjectedDeps());

export const persistMetadataStore = () => persistMetadata(getInjectedDeps());

export const getDataset = (datasetId: string) => getDatasetWithDeps(datasetId, getInjectedDeps());

export const setDataset = (dataset: DatasetMetadata) => setDatasetWithDeps(dataset, getInjectedDeps());

export const listDatasets = () => listDatasetsWithDeps(getInjectedDeps());

export const deleteDataset = (datasetId: string) => deleteDatasetFromStore(datasetId, getInjectedDeps());
