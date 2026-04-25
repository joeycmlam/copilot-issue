# copilot-issue

Monorepo containing the Copilot Issue API and UI.

```
copilot-issue/
├── api/   # FastAPI service (Python / Poetry)
└── ui/    # React + Vite frontend (TypeScript / npm)
```

## Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Poetry | ≥ 1.6 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

## Getting started

```bash
# Install all dependencies
make install

# Start both dev servers in parallel
make dev
```

The API will be available at `http://localhost:8000` and the UI at `http://localhost:5173`.

## Commands

```
make dev        Start both API and UI dev servers in parallel
make dev-api    Start FastAPI dev server only
make dev-ui     Start Vite/Express UI dev server only
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

React + Vite frontend for composing and managing Copilot agent issues.
