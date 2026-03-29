"use client";

import { useCallback, useEffect, useState } from "react";

export const useDashboard = (datasetId: string | null) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!datasetId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dataset/${encodeURIComponent(datasetId)}/dashboard`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.reason || payload?.detail || `Dashboard failed: ${response.status}`);
      }
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
};
