import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "";

// =============================================================================
// Settings provider hook into queryClient.
// We can't use React state directly here, so we expose a registration function.
// SettingsProvider calls registerSettingsAccessor once with a getter that
// returns the live settings.
// =============================================================================

type Settings = {
  apiBaseUrl: string; // "" => use same-origin proxy (server-side default)
  pat: string;
};

let settingsAccessor: () => Settings = () => ({ apiBaseUrl: "", pat: "" });

export function registerSettingsAccessor(fn: () => Settings) {
  settingsAccessor = fn;
}

function buildHeaders(json: boolean): Record<string, string> {
  const { apiBaseUrl, pat } = settingsAccessor();
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (apiBaseUrl) headers["X-Upstream-Base"] = apiBaseUrl;
  if (pat) headers["X-PAT-Override"] = pat;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * apiRequest — used for ALL HTTP calls from the UI.
 * Paths starting with `/proxy/...` are forwarded through the BFF to the
 * upstream FastAPI service. Paths starting with `/api/...` (e.g. `/api/_meta`)
 * hit the BFF directly.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  // The BFF mounts the upstream proxy at /api/proxy/*; UI paths are written as
  // `/proxy/repos/...` so they read closer to the upstream API surface.
  const fullUrl = url.startsWith("/proxy")
    ? `${API_BASE}/api${url}`
    : `${API_BASE}${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: buildHeaders(Boolean(data)),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // The first cache segment is the path. Remaining segments are appended
    // verbatim — see useQuery({ queryKey: ['/proxy/agents/repo', owner, repo] }).
    const path = (queryKey as ReadonlyArray<unknown>)
      .map((s) => String(s))
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/");
    const fullUrl = path.startsWith("/proxy")
      ? `${API_BASE}/api${path}`
      : `${API_BASE}${path}`;

    const res = await fetch(fullUrl, { headers: buildHeaders(false) });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
