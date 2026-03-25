"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "../../../i18n/navigation";
import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

type BackendDataset = {
  dataset_id?: string;
  created_at?: string;
  row_count?: number;
  columns?: string[] | number;
  source_file_name?: string;
  datasetId?: string;
  createdAt?: string;
  rowCount?: number;
  sourceFileName?: string;
};

type DatasetListItem = {
  datasetId: string;
  createdAt: string;
  rowCount: number;
  columns: number;
  sourceFileName: string;
};

type UploadResponse = {
  data: {
    dataset_id?: string;
    datasetId?: string;
  };
};

type AnalyticsStatusResponse = {
  status: "pending" | "processing" | "completed";
  available_modules?: string[];
};

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.reason || payload?.detail || `Request failed: ${response.status}`);
  }
  return response.json();
};

const DataPage = () => {
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState("");
  const [activeDatasetIdRef] = useState<{ current: string }>({ current: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [analyticsStatus, setAnalyticsStatus] = useState<AnalyticsStatusResponse | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((dataset) => dataset.datasetId === activeDatasetId) ?? null,
    [datasets, activeDatasetId]
  );

  useEffect(() => {
    activeDatasetIdRef.current = activeDatasetId;
  }, [activeDatasetId, activeDatasetIdRef]);

  const refreshDatasets = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorText("");
    try {
      const response = await fetchJson<{ status: string; data: BackendDataset[] }>(
        "/api/datasets",
        { cache: "no-store", signal }
      );
      const normalized = (response.data || []).map((item) => ({
        datasetId: item.dataset_id ?? item.datasetId ?? "",
        createdAt: item.created_at ?? item.createdAt ?? "",
        rowCount: item.row_count ?? item.rowCount ?? 0,
        columns: typeof item.columns === "number" ? item.columns : item.columns?.length ?? 0,
        sourceFileName: item.source_file_name ?? item.sourceFileName ?? "",
      }));
      setDatasets(normalized);

      const stored = typeof window !== "undefined" ? window.localStorage.getItem("activeDatasetId") ?? "" : "";
      const next = activeDatasetIdRef.current || stored || normalized[0]?.datasetId || "";
      if (next) {
        setActiveDatasetId(next);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("activeDatasetId", next);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeDatasetIdRef]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      refreshDatasets(controller.signal).catch((error) => {
        if (!controller.signal.aborted) {
          setErrorText(error instanceof Error ? error.message : "Failed to load datasets");
        }
      });
    }, 0);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [refreshDatasets]);

  const handleSelectDataset = (datasetId: string) => {
    setActiveDatasetId(datasetId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("activeDatasetId", datasetId);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    const controller = new AbortController();
    setIsUploading(true);
    setErrorText("");
    setAnalyticsStatus({ status: "pending", available_modules: [] });
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const payload = await fetchJson<UploadResponse>("/api/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const datasetId = payload?.data?.dataset_id ?? payload?.data?.datasetId ?? "";
      if (!datasetId) {
        throw new Error("Upload response missing dataset id");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeDatasetId", datasetId);
      }
      await refreshDatasets();
      setActiveDatasetId(datasetId);

      const pollEveryMs = 3000;
      const maxWaitMs = 2 * 60 * 1000;
      const startedAt = Date.now();
      while (Date.now() - startedAt < maxWaitMs && !controller.signal.aborted) {
        const status = await fetchJson<AnalyticsStatusResponse>(
          `/api/analytics/status/${encodeURIComponent(datasetId)}`,
          { cache: "no-store", signal: controller.signal }
        ).catch((): AnalyticsStatusResponse => ({ status: "pending", available_modules: [] }));
        setAnalyticsStatus(status);
        if (status.status === "completed") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
      }

      if (!controller.signal.aborted) {
        router.push(`/analytics?tab=purchase-frequency&datasetId=${encodeURIComponent(datasetId)}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Upload was cancelled, don't show error
        return;
      }
      setErrorText(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteDataset = async () => {
    if (!activeDatasetId) {
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setErrorText("");
    try {
      await fetchJson(`/api/dataset/${activeDatasetId}`, { 
        method: "DELETE",
        signal: controller.signal,
      });
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("activeDatasetId");
        if (stored === activeDatasetId) {
          window.localStorage.removeItem("activeDatasetId");
        }
      }
      setActiveDatasetId("");
      await refreshDatasets();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Delete was cancelled, don't show error
        return;
      }
      setErrorText(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Data">
      <div className="grid grid-cols-1 gap-4 1xl:gap-6">
        <Card title="Dataset Session">
          <div className="pt-5 grid grid-cols-1 lg:grid-cols-4 gap-3">
            <label className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg cursor-pointer">
              {isUploading ? "Uploading..." : "Upload CSV"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleUpload} />
            </label>
            <select
              className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg"
              value={activeDatasetId}
              onChange={(event) => handleSelectDataset(event.target.value)}
            >
              <option value="">Select dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.datasetId} value={dataset.datasetId}>
                  {dataset.sourceFileName} • {dataset.rowCount.toLocaleString()} rows
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refreshDatasets()}
              className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg disabled:opacity-50"
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleDeleteDataset}
              disabled={!activeDatasetId || isLoading}
              className="border border-mainBorder rounded-md px-3 py-2 text-primaryText text-sm bg-inputBg disabled:opacity-50"
            >
              Delete Active
            </button>
          </div>
          {activeDataset ? (
            <div className="mt-4 rounded-lg border border-mainBorder bg-inputBg px-4 py-3 text-sm text-primaryText">
              <span className="text-secondaryText">Active dataset:</span> {activeDataset.sourceFileName} •{" "}
              {activeDataset.rowCount.toLocaleString()} rows • {new Date(activeDataset.createdAt).toLocaleString()}
            </div>
          ) : null}
          {analyticsStatus && analyticsStatus.status !== "completed" ? (
            <div className="mt-4 rounded-lg border border-mainBorder bg-inputBg px-4 py-3 text-sm text-secondaryText">
              Analytics processing: {analyticsStatus.status}
            </div>
          ) : null}
        </Card>

        {errorText ? (
          <Card title="Error">
            <div className="pt-4 text-sm text-red-400">{errorText}</div>
          </Card>
        ) : null}
      </div>
    </PageWrapper>
  );
};

export default DataPage;
