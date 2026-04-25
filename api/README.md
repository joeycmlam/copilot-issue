# GitHub Copilot Issue Assignment API v2

A FastAPI service that wraps the GitHub REST API to create GitHub Issues and
assign them to the Copilot coding agent (`copilot-swe-agent[bot]`), with full
support for **org-level reusable custom agents**, a **skill registry**, **tool
references**, and **firm-knowledge (RAG) pointers** — all expressed in
GitHub-native primitives.

> **Design philosophy — build less, use more.**
> The Copilot coding agent already owns the execution loop. Custom-agent
> profiles (`.agent.md`) already compose tools, MCP servers, models, and
> handoffs. We do **not** rebuild any of that. This service is a thin façade
> that lets a human (or upstream system like JIRA / ServiceNow) hand a
> well-shaped issue to Copilot and let GitHub resolve the right agent.

---

## How this maps to the conceptual architecture

The diagram in `01_conceptual_architecture.drawio` describes an AI agentic
team with a Supervisor, six role-agents, a versioned skill registry, a
firm-knowledge RAG layer, and an enterprise tool landscape. Here is how each
layer is realised — and where we deliberately delegate to GitHub.

| Conceptual layer            | Realisation                                                                | Owned by us? |
|----------------------------|----------------------------------------------------------------------------|--------------|
| Human-in-the-loop oversight | The `POST /create-and-assign` endpoint is the human entry point             | ✅            |
| Supervisor / Orchestrator   | The GitHub Issue itself + Copilot's agent loop                              | ❌ (GitHub)   |
| Role agents (BA, Arch, …)   | `.agent.md` profiles in `<org>/.github-private/agents/`                     | ❌ (GitHub)   |
| Skill registry              | Skill **names + versions** referenced in the issue body and in agent files | ✅ (façade)   |
| Tool references             | Tool names listed in agent profile YAML (built-in + MCP servers)            | ❌ (GitHub)   |
| Firm knowledge / RAG        | `knowledge_refs` injected into the issue body; agents fetch via tools       | ✅ (façade)   |
| Enterprise tool landscape   | MCP servers configured at the org / agent level                             | ❌ (GitHub)   |

**What we explicitly do not build:** orchestration runtime, skill executor,
RAG pipeline, agent registry, tool gateway. All exist natively in the Copilot
ecosystem; we point Copilot at them.

---

## Custom Agent Scoping

| Scope       | File location                                              | Reusable across repos? |
|-------------|-----------------------------------------------------------|------------------------|
| Repo-level  | `.github/agents/<name>.agent.md`  (in target repo)        | ❌ This repo only       |
| Org-level   | `agents/<name>.md` in `<org>/.github-private`             | ✅ All repos in org     |
| Enterprise  | `agents/<name>.md` in enterprise `.github-private`        | ✅ All repos in enterprise |

**Resolution order** (GitHub-native): repo → org → enterprise.
You pass only the agent *name* in `custom_agent`; GitHub resolves the level.

---

## Repository Layout

```
copilot-issue-api-v2/                ← This service (deploy anywhere)
├── app/
│   ├── __init__.py
│   ├── main.py                      ← FastAPI app + routes
│   ├── models.py                    ← Pydantic request/response schemas
│   ├── services.py                  ← GitHub client + agent resolver + issue svc
│   └── config.py                    ← Settings (env-driven)
├── examples/
│   ├── org-agents/                  ← Drop into <org>/.github-private/agents/
│   │   ├── ba-agent.md
│   │   ├── architect-agent.md
│   │   ├── backend-agent.md
│   │   ├── qa-agent.md
│   │   ├── security-agent.md
│   │   ├── devops-agent.md
│   │   └── observability-agent.md
│   └── repo-agents/                 ← Drop into <repo>/.github/agents/
│       └── local-db-agent.agent.md
├── tests/
│   └── test_service.py
├── pyproject.toml
├── Dockerfile
├── .env.example
└── examples.http
```

---

## Quick Start

```bash
poetry install
cp .env.example .env        # add your PAT
poetry run uvicorn app.main:app --reload
open http://localhost:8000/docs
```

### PAT requirements

| Scope               | What it enables                                           |
|---------------------|-----------------------------------------------------------|
| `repo`              | Create issues, assign `copilot-swe-agent[bot]`            |
| `read:org`          | Read `<org>/.github-private/agents/*.md`                  |
| `admin:enterprise`  | Read enterprise-level agents (only if you use them)       |

> The token must belong to a user who has Copilot coding agent access on the
> target repository. A workflow's default `GITHUB_TOKEN` does **not** work.

---

## Key API endpoints

| Method | Path                                              | Purpose                                  |
|--------|---------------------------------------------------|------------------------------------------|
| POST   | `/repos/{o}/{r}/issues`                           | Create issue from prompt                 |
| POST   | `/repos/{o}/{r}/issues/{n}/assign-copilot`        | Assign issue to Copilot + custom agent   |
| POST   | `/repos/{o}/{r}/issues/create-and-assign`         | Create + assign in one call              |
| GET    | `/agents/repo/{owner}/{repo}`                     | List repo-level agents                   |
| GET    | `/agents/org/{org}`                               | List org-level agents                    |
| GET    | `/agents/enterprise/{ent}`                        | List enterprise-level agents             |
| GET    | `/agents/{owner}/{repo}/all`                      | All agents, repo → org → enterprise      |
| GET    | `/health`                                         | Liveness                                 |

The full OpenAPI is auto-generated at `/docs` (Swagger UI) and `/redoc`.

### Example payload (`create-and-assign`)

```json
{
  "title": "Add idempotency keys to /v1/payments",
  "prompt": "User story + acceptance criteria here…",
  "labels": ["enhancement", "api"],
  "skills": [
    { "name": "code-generation", "version": "1.4.0" },
    { "name": "test-generation" },
    { "name": "doc-authoring" }
  ],
  "tools": [
    { "name": "github", "type": "builtin" },
    { "name": "kql-adx", "type": "mcp" }
  ],
  "knowledge_refs": [
    { "kind": "repo_path", "value": "docs/adr/0007-idempotency.md" },
    { "kind": "repo_path", "value": "docs/api/openapi.yaml" }
  ],
  "agent": {
    "custom_agent": "backend-agent",
    "base_branch": "main",
    "custom_instructions": "Follow ADR 0007 strictly."
  }
}
```

The service:

1. Renders `prompt` + a structured `Copilot directives` block (skills, tools,
   knowledge refs) into the issue body.
2. Adds `copilot-swe-agent[bot]` to assignees.
3. Forwards the `agent` block as GitHub's `agent_assignment` — including
   `custom_agent`, which GitHub resolves repo → org → enterprise.

---

## Custom agent profiles

The `examples/org-agents/` directory contains seven ready-to-use profiles
that mirror the role-agents in the conceptual diagram:

| Diagram role      | Agent file                  | Primary skills                                 |
|-------------------|-----------------------------|------------------------------------------------|
| BA / PO           | `ba-agent.md`               | requirement-parse, jira-workflow               |
| Architect         | `architect-agent.md`        | doc-authoring, code-review                     |
| Engineer          | `backend-agent.md`          | code-generation, test-generation, code-review  |
| QA expert         | `qa-agent.md`               | test-generation, requirement-parse             |
| Security expert   | `security-agent.md`         | security-scan, change-mgmt                     |
| DevOps            | `devops-agent.md`           | deploy-rollback, observability, kql-analytics  |
| (Specialist)      | `observability-agent.md`    | kql-analytics, observability, doc-authoring    |

To deploy them organisation-wide:

```bash
# From your org admin, in <org>/.github-private:
mkdir -p agents
cp copilot-issue-api-v2/examples/org-agents/*.md agents/
git add agents && git commit -m "feat: org-wide Copilot custom agents" && git push
```

After that, **every repo in the org** can address them by name:

```json
{ "agent": { "custom_agent": "qa-agent" } }
```

---

## Skill registry — how it works without a runtime

Skills (codegen, test-gen, security-scan, …) are **names**, not code paths in
this service. They live in two places:

1. **In each agent profile**, as the `tools:` list and the prose body that
   tells the agent how to compose them.
2. **In the issue body**, as a `Copilot directives` block:

   ```markdown
   <!-- copilot-issue-api-v2: directives -->

   ## Copilot directives

   **Skills** (from the firm skill registry):
   - `code-generation` @ `1.4.0`
   - `test-generation`

   **Tools**:
   - `github` (builtin)
   - `kql-adx` (mcp)

   **Knowledge references** (RAG sources to ground on):
   - `repo_path`: docs/adr/0007-idempotency.md

   <!-- /copilot-issue-api-v2 -->
   ```

The Copilot agent — guided by its `.agent.md` profile — reads the directives
and binds the corresponding tools / skills. This keeps the registry **versioned
and composable** (principle 1 from the diagram) without a custom executor.

---

## Firm-knowledge (RAG) — pointers, not pipelines

`knowledge_refs[]` is a list of typed pointers: `repo_path`, `url`, or
`glossary`. The service does not embed, chunk, or rerank — those are jobs
for tools the agent already has (e.g. a `firm-rag` MCP server). The service
just makes sure the references are visible in the issue context.

This realises principle 2 of the diagram (*RAG before every skill invocation*)
without a server-side pipeline: the agent itself fetches at task time.

---

## Local development

```bash
poetry install
poetry run uvicorn app.main:app --reload
poetry run pytest -q
```

`examples.http` covers every endpoint and works in VS Code REST Client.

## Containerised deployment

```bash
docker build -t copilot-issue-api-v2 .
docker run --rm -p 8000:8000 --env-file .env copilot-issue-api-v2
```

The Dockerfile uses a multi-stage build, runs as a non-root user, and exposes
a `HEALTHCHECK` against `/health`.

---

## References

- [Assign issues to Copilot using the API](https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/) — the REST + GraphQL contract this service wraps.
- [Custom agents for Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-custom-agents) — the `.agent.md` format.
- [Asking GitHub Copilot to create a pull request](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-a-pr) — end-to-end workflow.
