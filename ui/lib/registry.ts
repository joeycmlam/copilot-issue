// =============================================================================
// Static catalogues used to populate pickers in the UI.
//
// These are *not* fetched from the upstream service — they are the firm-wide
// lists that the conceptual architecture treats as registry items. The user
// can always type custom values where needed; these just speed up common
// selections.
// =============================================================================

export const SKILLS: { name: string; suggestedVersion?: string; hint: string }[] = [
  { name: "code-generation", suggestedVersion: "1.4.0", hint: "Synthesise code changes from spec" },
  { name: "test-generation", hint: "Author unit/integration tests" },
  { name: "security-scan", hint: "Run SAST/DAST + secrets review" },
  { name: "doc-authoring", hint: "Update README/ADR/runbooks" },
  { name: "git-operations", hint: "Branch/PR/merge mechanics" },
  { name: "deploy-rollback", hint: "Push or revert deployments" },
  { name: "jira-workflow", hint: "Sync state with JIRA" },
  { name: "kql-analytics", hint: "Query Azure Data Explorer" },
  { name: "observability", hint: "Read logs/metrics/traces" },
  { name: "code-review", hint: "Critique diffs against guidelines" },
  { name: "requirement-parse", hint: "Turn user stories into AC" },
  { name: "change-mgmt", hint: "Open / advance change tickets" },
];

export const TOOL_TYPES = ["builtin", "mcp", "server"] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOLS: { name: string; type: ToolType; hint: string }[] = [
  { name: "github", type: "builtin", hint: "Repos / Issues / PRs" },
  { name: "shell", type: "builtin", hint: "Run shell commands in workspace" },
  { name: "jira", type: "mcp", hint: "Atlassian JIRA via MCP" },
  { name: "servicenow", type: "mcp", hint: "ServiceNow ITSM via MCP" },
  { name: "kql-adx", type: "mcp", hint: "KQL on Azure Data Explorer" },
  { name: "newrelic", type: "mcp", hint: "Telemetry queries" },
  { name: "firm-rag", type: "mcp", hint: "Firm knowledge retrieval" },
];

export const KNOWLEDGE_KINDS = ["repo_path", "url", "glossary"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const SUGGESTED_AGENTS: { name: string; role: string }[] = [
  { name: "ba-agent", role: "Business analyst / requirement parsing" },
  { name: "architect-agent", role: "Architecture & ADRs" },
  { name: "backend-agent", role: "Backend implementation" },
  { name: "qa-agent", role: "Test design & coverage" },
  { name: "security-agent", role: "Security & change mgmt" },
  { name: "devops-agent", role: "Deploy / rollback / SRE" },
  { name: "observability-agent", role: "KQL / NR / dashboards" },
];

// Common Copilot-supported model identifiers — free-form input; this is
// just a hint list for the datalist suggestions.
export const SUGGESTED_MODELS = [
  "claude-sonnet-4",
  "claude-sonnet-4.5",
  "claude-opus-4.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "o4-mini",
  "gemini-2.5-pro",
];
