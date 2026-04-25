import { NextRequest, NextResponse } from "next/server";

const DEFAULT_UPSTREAM =
  process.env.COPILOT_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await context.params;

  const upstreamBase = (
    req.headers.get("x-upstream-base") || DEFAULT_UPSTREAM
  ).replace(/\/$/, "");

  const tail = "/" + (pathSegments ?? []).join("/") + req.nextUrl.search;
  const upstreamUrl = `${upstreamBase}${tail}`;

  const headers: Record<string, string> = { accept: "application/json" };
  const contentType = req.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    headers["content-type"] = "application/json";
  }

  const pat = req.headers.get("x-pat-override");
  if (pat) headers["authorization"] = `Bearer ${pat}`;

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        message: "Upstream unreachable",
        upstream: upstreamUrl,
        error: String((err as Error)?.message ?? err),
      },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
