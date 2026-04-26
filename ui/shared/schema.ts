import { z } from "zod";

// =============================================================================
// Domain types — mirror the FastAPI service's Pydantic models.
//
// These are NOT persisted; the UI is stateless. They live here so frontend and
// backend (the proxy) share the exact same shape we forward to the upstream
// Copilot Issue Assignment API v2.
// =============================================================================

export const skillRefSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
});
export type SkillRef = z.infer<typeof skillRefSchema>;

export const toolRefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["builtin", "mcp", "server"]).default("mcp"),
});
export type ToolRef = z.infer<typeof toolRefSchema>;

export const knowledgeRefSchema = z.object({
  kind: z.enum(["repo_path", "url", "glossary"]),
  value: z.string().min(1),
});
export type KnowledgeRef = z.infer<typeof knowledgeRefSchema>;

export const agentAssignmentSchema = z.object({
  target_repo: z.string().optional(),
  base_branch: z.string().optional(),
  custom_instructions: z.string().default(""),
  custom_agent: z.string().default(""),
  model: z.string().default(""),
});
export type AgentAssignment = z.infer<typeof agentAssignmentSchema>;

export const createIssueSchema = z.object({
  title: z.string().min(1).max(256),
  prompt: z.string().min(1),
  labels: z.array(z.string()).default([]),
  assignees: z.array(z.string()).default([]),
  milestone: z.number().int().nullable().optional(),
  skills: z.array(skillRefSchema).default([]),
  tools: z.array(toolRefSchema).default([]),
  knowledge_refs: z.array(knowledgeRefSchema).default([]),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const createAndAssignSchema = createIssueSchema.extend({
  agent: agentAssignmentSchema.default({
    custom_instructions: "",
    custom_agent: "",
    model: "",
  }),
});
export type CreateAndAssignInput = z.infer<typeof createAndAssignSchema>;

export const assignCopilotSchema = z.object({
  agent: agentAssignmentSchema.default({
    custom_instructions: "",
    custom_agent: "",
    model: "",
  }),
  keep_existing_assignees: z.boolean().default(true),
});
export type AssignCopilotInput = z.infer<typeof assignCopilotSchema>;

// Issue list item — mirrors IssueListItem in the FastAPI service.
export const issueListItemSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string(),
  title: z.string(),
  assignees: z.array(z.string()).default([]),
  copilot_assigned: z.boolean().default(false),
  custom_agent: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type IssueListItem = z.infer<typeof issueListItemSchema>;

export const issueListResponseSchema = z.object({
  items: z.array(issueListItemSchema),
});
export type IssueListResponse = z.infer<typeof issueListResponseSchema>;

// Custom agent — mirrors CustomAgent in the FastAPI service.
export const customAgentSchema = z.object({
  name: z.string(),
  scope: z.enum(["repo", "org", "enterprise"]),
  source_repo: z.string(),
  path: z.string(),
  description: z.string().nullable().optional(),
  tools: z.array(z.string()).default([]),
  handoffs: z.array(z.string()).default([]),
  target: z.enum(["vscode", "github-copilot", "any"]).default("any"),
});
export type CustomAgent = z.infer<typeof customAgentSchema>;

export const agentListResponseSchema = z.object({
  scope: z.enum(["repo", "org", "enterprise", "all"]),
  agents: z.array(customAgentSchema),
});
export type AgentListResponse = z.infer<typeof agentListResponseSchema>;

// Settings the UI persists in React state (NOT localStorage — blocked in iframe).
export const settingsSchema = z.object({
  // "" => use same-origin /api proxy. A full URL means direct browser->FastAPI.
  apiBaseUrl: z.string().default(""),
  pat: z.string().default(""),
  defaultOwner: z.string().default(""),
  defaultRepo: z.string().default(""),
  defaultBaseBranch: z.string().default("main"),
  defaultEnterprise: z.string().default(""),
});
export type Settings = z.infer<typeof settingsSchema>;

