import { NextResponse } from "next/server";

const DEFAULT_UPSTREAM =
  process.env.COPILOT_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export function GET() {
  return NextResponse.json({
    proxy: "ok",
    upstream_default: DEFAULT_UPSTREAM,
    version: "0.1.0",
  });
}
