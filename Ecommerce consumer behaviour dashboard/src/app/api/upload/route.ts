import { NextResponse } from "next/server";

import { fetchFromBackends } from "../_utils";
import { uploadDataset } from "../../../lib/dynamicDashboard/core";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { status: "error", reason: "Missing file", errorId: "upload_missing_file" },
      { status: 400 }
    );
  }
  const forward = new FormData();
  forward.append("file", file);
  try {
    const { response, data } = await fetchFromBackends(
      "upload",
      {
      method: "POST",
      body: forward,
      },
      request
    );
    return NextResponse.json(data, { status: response.status });
  } catch {
    try {
      const result = await uploadDataset(file);
      return NextResponse.json({
        status: "ok",
        data: {
          dataset_id: result.datasetId,
          row_count: result.rowCount,
          columns: result.columns,
          preview: result.preview,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Upload failed";
      return NextResponse.json(
        { status: "error", reason, errorId: "upload_failed" },
        { status: 400 }
      );
    }
  }
}
