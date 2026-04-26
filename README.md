# copilot-issue

Monorepo containing the Copilot Issue API and UI.

```
copilot-issue/
├── api/   # FastAPI service (Python / Poetry)
└── ui/    # Next.js 14 frontend (TypeScript / npm)
```

## Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Poetry | ≥ 1.6 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/<org>/copilot-issue.git
cd copilot-issue
```

### 2. Configure the API

```bash
cp api/.env.example api/.env
```

Open `api/.env` and set at minimum:

```
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

The token must be a classic or fine-grained PAT with `repo` and `read:org` scopes, belonging to a user who has Copilot coding agent access on the target repository.

### 3. Install dependencies

```bash
make install
```

### 4. Start the dev servers

```bash
make dev
```

The API will be available at `http://localhost:8000` and the UI at `http://localhost:3008`.

## Commands

```
make dev        Start both API and UI dev servers in parallel
make dev-api    Start FastAPI dev server only (http://localhost:8000)
make dev-ui     Start Next.js UI dev server only (http://localhost:3008)
make build      Build the UI for production
make test       Run all tests (Python pytest + TS type-check)
make test-api   Run Python tests
make check-ui   TypeScript type-check the UI
make install    Install all dependencies
make help       Show available commands
```

## Projects

### `api/`

FastAPI service that creates GitHub Issues and assigns them to the Copilot coding agent.  
See [api/README.md](api/README.md) for full details.

### `ui/`

Next.js 14 frontend for composing and managing Copilot agent issues.
