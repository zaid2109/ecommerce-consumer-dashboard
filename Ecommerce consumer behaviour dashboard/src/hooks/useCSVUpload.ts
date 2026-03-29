"use client";

import { useCallback, useState } from "react";

type UploadResult = {
  datasetId: string;
};

export const useCSVUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.reason || payload?.detail || `Upload failed: ${response.status}`);
      }
      const datasetId = payload?.data?.dataset_id ?? payload?.data?.datasetId;
      if (!datasetId) {
        throw new Error("Upload response missing dataset id");
      }
      return { datasetId };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
};
