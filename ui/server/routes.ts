import type { Express, Request, Response } from "express";
import type { Server } from "node:http";

// =============================================================================
// Same-origin proxy to the upstream FastAPI Copilot Issue Assignment API v2.
//
// Why a proxy?
//   - Lets the React app run with a clean `/api/*` base, no CORS surprises.
//   - Lets the user (in the deployed UI) point at a custom upstream without
//     redeploying — they pass `X-Upstream-Base` from the Settings panel.
//
// Headers consumed (all optional):
//   X-Upstream-Base   absolute URL of the FastAPI service.
//                     If absent, falls back to env COPILOT_API_URL,
//                     finally to http://localhost:8000.
//   X-PAT-Override    if present, forwarded as Authorization: Bearer <pat>.
//                     The FastAPI service then uses this token instead of
//                     its own. Only useful when the user wants to test their
//                     own PAT against a service they trust.
// =============================================================================

const DEFAULT_UPSTREAM =
  process.env.COPILOT_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

const PROXY_PREFIX = "/api/proxy";

async function forward(req: Request, res: Response): Promise<void> {
  const upstreamBase = (
    (req.header("x-upstream-base") || DEFAULT_UPSTREAM) as string
  ).replace(/\/$/, "");

  // Strip the /api/proxy prefix and forward the rest of the path.
  const tail = req.originalUrl.startsWith(PROXY_PREFIX)
    ? req.originalUrl.slice(PROXY_PREFIX.length)
    : req.originalUrl;
  const upstreamUrl = `${upstreamBase}${tail || "/"}`;

  // Build forwarded headers. Drop hop-by-hop and host-related headers.
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (req.is("application/json")) headers["content-type"] = "application/json";

  const patOverride = req.header("x-pat-override");
  if (patOverride) {
    headers["authorization"] = `Bearer ${patOverride}`;
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.body !== undefined &&
    Object.keys(req.body).length > 0
  ) {
    init.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const text = await upstream.text();
    res
      .status(upstream.status)
      .set(
        "content-type",
        upstream.headers.get("content-type") || "application/json",
      )
      .send(text);
  } catch (err: any) {
    res.status(502).json({
      message: "Upstream unreachable",
      upstream: upstreamUrl,
      error: String(err?.message ?? err),
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Health check the FE polls to confirm the BFF (this proxy) is alive.
  app.get("/api/_meta", (_req, res) => {
    res.json({
      proxy: "ok",
      upstream_default: DEFAULT_UPSTREAM,
      version: "0.1.0",
    });
  });

  // Catch-all proxy. Methods we forward: GET, POST, PATCH, DELETE.
  // Express 5 / path-to-regexp v6 require named splat: `*tail`, not `/*`.
  app.all(`${PROXY_PREFIX}/*tail`, forward);
  app.all(PROXY_PREFIX, forward);

  return httpServer;
}
