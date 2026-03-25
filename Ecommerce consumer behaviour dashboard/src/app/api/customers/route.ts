import { NextResponse } from "next/server";

import { fetchFromBackends } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { response, data } = await fetchFromBackends(
      "customers",
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
