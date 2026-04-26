# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

```
api/   FastAPI service — creates GitHub issues and assigns them to the Copilot coding agent
ui/    Next.js 14 frontend — browser console for the API
```

## Commands

All common operations are in the root `Makefile` (`make help` to list):

```bash
make install      # install api (Poetry) + ui (npm) deps
make dev          # start both servers in parallel
make dev-api      # FastAPI on http://localhost:8000 (auto-reload)
make dev-ui       # Next.js on http://localhost:3008
make build        # Next.js production build
make test         # run api pytest + ui tsc check
make test-api     # python tests only
make check-ui     # TypeScript type-check only
```

Run a single Python test:
```bash
cd api && poetry run pytest tests/test_service.py::test_render_body -xvs
```

## API service (`api/`)

**Stack**: FastAPI 0.115, Pydantic v2, httpx (async), PyYAML, Poetry.

**Entry point**: `app/main.py` — mounts routers, manages a shared `httpx.AsyncClient` via lifespan.

**Layer structure**:
- `app/config.py` — `Settings` (Pydantic BaseSettings, reads `.env`); builds GitHub REST and GraphQL auth headers.
- `app/models.py` — all Pydantic request/response schemas (`SkillRef`, `ToolRef`, `KnowledgeRef`, `CreateAndAssignRequest`, etc.).
- `app/services.py` — `GitHubClient` (async REST/GraphQL wrapper), `AgentResolver` (reads `.agent.md` files from GitHub), `IssueService` (composes issue bodies and calls GitHub).
- `app/main.py` — FastAPI DI wiring via `Depends(get_gh)`, `Depends(get_issue_service)`, `Depends(get_resolver)`.

**Custom agent resolution** (GitHub-native, no custom storage):
1. Agents are YAML-frontmatter + Markdown files (`.agent.md` / `.md`) hosted in GitHub:
   - Repo-level: `{repo}/.github/agents/<name>.agent.md` (highest priority)
   - Org-level: `{org}/.github-private/agents/<name>.md`
   - Enterprise-level: `{ent_owner}/.github-private/agents/<name>.md`
2. `AgentResolver.list_all()` fetches all three concurrently and deduplicates (repo wins).
3. The API passes `custom_agent: "<name>"` to GitHub's issue API; GitHub resolves the file.
4. Example agent profiles live in `api/examples/`.

**Issue body pattern**: `IssueService.render_issue_body()` injects a fenced `<!-- copilot-issue-api-v2: directives -->` block into the issue body. The Copilot agent reads this block to bind skills, tools, and knowledge references — the API does not execute them.

**Required PAT scopes**: `repo`, `read:org` (for org agents), `admin:enterprise` (for enterprise agents). The PAT must belong to a user with Copilot coding agent access (workflow tokens do not work).

**Config** (`api/.env.example`):
```
GITHUB_TOKEN=          # required
COPILOT_BOT_LOGIN=copilot-swe-agent[bot]
DEFAULT_BASE_BRANCH=main
DEFAULT_ENTERPRISE=
GITHUB_API_URL=        # optional GHES override
```

## UI service (`ui/`)

**Stack**: Next.js 14 App Router, React 18, TanStack Query v5, shadcn/ui (Radix + Tailwind), TypeScript.

**Path aliases** (`tsconfig.json`):
- `@/*` → `ui/*` (root of the ui workspace)
- `@shared/*` → `ui/shared/*`

**Provider tree** (`components/layout/ClientLayout.tsx`, `"use client"`):
```
QueryClientProvider
  ThemeProvider         (light/dark; reads prefers-color-scheme; no localStorage)
    SettingsProvider    (API URL, PAT, repo defaults; React state only — iframe-safe)
      TooltipProvider
        SidebarProvider
          AppSidebar + header shell
          {children}   ← active Next.js page
        Toaster
```

**Page pattern**: Each `app/{route}/page.tsx` is a thin `"use client"` re-export from `views/{name}.tsx`. Logic lives in `views/`, routing in `app/`.

**BFF proxy** (`app/api/proxy/[...path]/route.ts`):
- All client fetches to `/proxy/...` are rewritten to `/api/proxy/...` by `lib/queryClient.ts`.
- The Next.js route handler forwards them to the upstream FastAPI service.
- Two optional client-sent headers control behaviour:
  - `X-Upstream-Base` — override the FastAPI URL (defaults to `COPILOT_API_URL` env or `localhost:8000`).
  - `X-PAT-Override` — forwarded as `Authorization: Bearer <pat>` to GitHub.

**Settings ↔ QueryClient bridge** (non-obvious): `SettingsProvider` calls `registerSettingsAccessor()` once on mount with a ref getter. `buildHeaders()` in `lib/queryClient.ts` calls this getter on every fetch to inject live `X-Upstream-Base` / `X-PAT-Override` headers without prop drilling into the singleton queryClient.

**queryKey-as-URL convention**: TanStack Query keys are URL path segments. The default `queryFn` joins the key array with `/` to build the fetch URL:
```typescript
useQuery({ queryKey: ['/proxy/agents/repo', owner, repo] })
// → GET /api/proxy/agents/repo/{owner}/{repo}
```

**Static registry** (`lib/registry.ts`): Hardcoded lists of skills, tools, knowledge kinds, suggested agents and models used as UI picker hints. Not fetched from the API.

**Shared types** (`shared/schema.ts`): Zod schemas that mirror the FastAPI Pydantic models exactly, shared between `views/` and `lib/`.
