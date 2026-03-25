import { NextResponse } from "next/server";

import { fetchFromBackends } from "../_utils";
import { listDatasets } from "../../../lib/dynamicDashboard/core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.searchParams);
  let datasetId: string | undefined =
    searchParams.get("dataset_id") ||
    searchParams.get("datasetId") ||
    listDatasets()[0]?.datasetId;
  if (!datasetId) {
    try {
      const { data } = await fetchFromBackends("datasets", { cache: "no-store" }, request);
      const first = (data as { data?: Array<{ dataset_id?: string; datasetId?: string }> })?.data?.[0];
      datasetId = first?.dataset_id || first?.datasetId;
    } catch (error) {
      void error;
    }
  }
  if (!datasetId) {
    return NextResponse.json(
      { status: "error", reason: "Dataset not found", errorId: "dataset_not_found" },
      { status: 404 }
    );
  }
  searchParams.set("dataset_id", datasetId);
  try {
    const { response, data } = await fetchFromBackends(
      `purchase-frequency?${searchParams.toString()}`,
      { cache: "no-store" },
      request
    );
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { status: "error", reason: "Backend unreachable", errorId: "backend_unreachable" },
      { status: 502 }
    );
  }
}
