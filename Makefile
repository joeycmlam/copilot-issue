.PHONY: install install-api install-ui dev dev-api dev-ui build test test-api check-ui

# ── Install ────────────────────────────────────────────────────────────────────
install: install-api install-ui

install-api:
	cd api && poetry install

install-ui:
	npm install

# ── Dev servers ────────────────────────────────────────────────────────────────
dev: ## Start both API and UI dev servers in parallel
	$(MAKE) -j2 dev-api dev-ui

dev-api: ## Start FastAPI dev server (http://localhost:8000)
	cd api && poetry run uvicorn app.main:app --reload

dev-ui: ## Start Next.js UI dev server (http://localhost:3008)
	npm run dev --workspace=ui

# ── Build ──────────────────────────────────────────────────────────────────────
build: ## Build the UI for production
	npm run build --workspace=ui

# ── Test & lint ────────────────────────────────────────────────────────────────
test: test-api check-ui

test-api: ## Run Python tests
	cd api && poetry run pytest

check-ui: ## TypeScript type-check the UI
	npm run check --workspace=ui

# ── Help ───────────────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
