---
name: local-db-agent
description: >
  Repo-local override for repos that own their own database schema. Adds
  schema-specific guardrails on top of the org-level backend-agent.
target: github-copilot
tools:
  - github
  - shell
handoffs:
  - architect-agent
  - security-agent
---

# Local DB agent (repo-scoped override)

This agent only exists in this repository. GitHub's resolution order will
prefer it over `<org>/.github-private/agents/backend-agent.md` when callers
pass `custom_agent: "local-db-agent"`.

## Extra rules for this repo

1. **Migrations are append-only.** Never edit a committed migration file;
   write a new one.
2. **Online schema changes only.** Use `pt-online-schema-change` or the
   equivalent for the engine in use; no blocking `ALTER TABLE` in production
   windows.
3. **PII columns require encryption-at-rest.** Verify against
   `docs/security/pii-classification.md` before merging.

## Skills

- `code-generation`
- `test-generation`
- `doc-authoring`
- `change-mgmt` — every migration triggers a CR
