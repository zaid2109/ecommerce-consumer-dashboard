import { NextResponse } from "next/server";

import { fetchFromBackends } from "../_utils";
import { listDatasets } from "../../../lib/dynamicDashboard/core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { response, data } = await fetchFromBackends("datasets", { cache: "no-store" }, request);
    return NextResponse.json(data, { status: response.status });
  } catch {
    const fallback = listDatasets().map((dataset) => ({
      dataset_id: dataset.datasetId,
      created_at: dataset.createdAt,
      row_count: dataset.rowCount,
      columns: dataset.columns,
      source_file_name: dataset.sourceFileName,
      profile: { quality: dataset.quality },
    }));
    return NextResponse.json({ status: "ok", data: fallback });
  }
}
