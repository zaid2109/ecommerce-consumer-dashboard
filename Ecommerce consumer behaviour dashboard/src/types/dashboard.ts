export type DatasetListItem = {
  datasetId: string;
  createdAt: string;
  rowCount: number;
  columns: number;
  sourceFileName: string;
};

export type ApiStatus<T = unknown> = {
  status: string;
  data: T;
};
