import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { status: "error", reason: "Not implemented in this project", errorId: "analyze_not_implemented" },
    { status: 501 }
  );
}
