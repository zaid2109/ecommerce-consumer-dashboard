import { NextResponse } from "next/server";

import { fetchFromBackends } from "../../../_utils";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ datasetId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const { datasetId } = await params;
  try {
    const { response, data } = await fetchFromBackends(
      `analytics/status/${datasetId}`,
      { cache: "no-store" },
      request
    );
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { status: "pending", available_modules: [] },
      { status: 200 }
    );
  }
}
