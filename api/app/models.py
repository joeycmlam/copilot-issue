"""Pydantic request/response schemas.

The shape of the public API is intentionally small: we only model what
callers send us and what we return. The wire shape we send to GitHub is
constructed inside `services.py` from these models — that keeps the public
contract decoupled from GitHub's preview headers.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Building blocks shared across endpoints
# ---------------------------------------------------------------------------


class SkillRef(BaseModel):
    """Reference to a versioned skill in the firm-wide skill registry.

    Skills are the reusable units shown in the conceptual diagram
    (codegen, test gen, sec scan, KQL, etc.). We don't execute them in this
    service; we surface them to the Copilot coding agent by injecting a
    structured directives block into the issue body so the agent's custom
    profile can compose them.
    """

    name: str = Field(..., examples=["code-generation", "test-generation"])
    version: str | None = Field(
        default=None,
        description="SemVer or git tag. Omit to take the registry default.",
        examples=["1.4.0"],
    )


class ToolRef(BaseModel):
    """Reference to a tool exposed to the Copilot agent.

    Tools are typically MCP servers (`server`) or built-in GitHub tools
    (`builtin`). The agent's `.agent.md` profile decides how to bind them;
    we just pass the names through.
    """

    name: str = Field(..., examples=["github", "kql-adx", "newrelic"])
    type: Literal["builtin", "mcp", "server"] = "mcp"


class KnowledgeRef(BaseModel):
    """Pointer into the firm-knowledge layer (RAG sources).

    Three kinds are recognised:
      - `repo_path`  -> a path in the target repo (ADRs, runbooks, schemas)
      - `url`        -> any HTTP(S) URL the agent can fetch
      - `glossary`   -> a logical glossary term resolved by the agent
    """

    kind: Literal["repo_path", "url", "glossary"]
    value: str


# ---------------------------------------------------------------------------
# Issue creation
# ---------------------------------------------------------------------------


class CreateIssueRequest(BaseModel):
    """Body for `POST /repos/{o}/{r}/issues`."""

    title: str = Field(..., min_length=1, max_length=256)
    prompt: str = Field(
        ...,
        min_length=1,
        description=(
            "The user-supplied story / acceptance criteria. Becomes the "
            "first section of the rendered issue body."
        ),
    )
    labels: list[str] = Field(default_factory=list)
    assignees: list[str] = Field(
        default_factory=list,
        description="Optional human assignees in addition to Copilot.",
    )
    milestone: int | None = None

    # Copilot directives — injected as a fenced block in the body so the
    # agent's `.agent.md` profile can pick them up.
    skills: list[SkillRef] = Field(default_factory=list)
    tools: list[ToolRef] = Field(default_factory=list)
    knowledge_refs: list[KnowledgeRef] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# Copilot assignment
# ---------------------------------------------------------------------------


class AgentAssignment(BaseModel):
    """Maps 1:1 to GitHub's `agent_assignment` REST input.

    Resolution order for `custom_agent` is GitHub-native:
        repo (.github/agents/<name>.agent.md)
          -> org   (<org>/.github-private/agents/<name>.md)
          -> enterprise (enterprise .github-private/agents/<name>.md)
    Pass only the agent NAME — never a path. GitHub resolves the level.
    """

    target_repo: str | None = Field(
        default=None,
        description="OWNER/REPO Copilot should commit into. Defaults to the issue's repo.",
        examples=["acme/payments-service"],
    )
    base_branch: str | None = Field(
        default=None, examples=["main"]
    )
    custom_instructions: str = Field(
        default="",
        description="Free-form extra instructions appended to the agent context.",
    )
    custom_agent: str = Field(
        default="",
        description=(
            "Name of the custom agent profile (no path, no extension). "
            "GitHub resolves repo -> org -> enterprise."
        ),
        examples=["backend-agent", "qa-agent"],
    )
    model: str = Field(
        default="",
        description="Optional Copilot model override (e.g. 'claude-sonnet-4').",
    )


class AssignCopilotRequest(BaseModel):
    """Body for `POST /repos/{o}/{r}/issues/{n}/assign-copilot`."""

    agent: AgentAssignment = Field(default_factory=AgentAssignment)
    keep_existing_assignees: bool = Field(
        default=True,
        description=(
            "If true, append Copilot to current assignees. If false, replace "
            "all assignees with just Copilot (uses replaceActorsForAssignable)."
        ),
    )


class CreateAndAssignRequest(CreateIssueRequest):
    """Body for `POST /repos/{o}/{r}/issues/create-and-assign`.

    Combines issue creation and Copilot assignment in one round trip. The
    `prompt` is rendered into the body (with skill/tool/knowledge directives)
    and `agent.custom_instructions` is forwarded to Copilot's agent assignment.
    """

    agent: AgentAssignment = Field(default_factory=AgentAssignment)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class IssueResponse(BaseModel):
    """Shape returned by issue create/assign endpoints."""

    number: int
    id: int | None = None
    node_id: str | None = None
    html_url: str
    state: str
    title: str
    assignees: list[str] = Field(default_factory=list)
    copilot_assigned: bool = False
    custom_agent: str | None = None
    target_repo: str | None = None
    base_branch: str | None = None


# ---------------------------------------------------------------------------
# Custom agent listing
# ---------------------------------------------------------------------------


class CustomAgent(BaseModel):
    """One custom agent profile discovered in a repo, org, enterprise, or the API service itself."""

    name: str
    scope: Literal["repo", "org", "enterprise", "service"]
    source_repo: str = Field(
        ...,
        description="OWNER/REPO where the .agent.md file lives, or '(built-in)' for service-level agents.",
    )
    path: str
    description: str | None = None
    tools: list[str] = Field(default_factory=list)
    handoffs: list[str] = Field(default_factory=list)
    target: Literal["vscode", "github-copilot", "any"] = "any"
    allowed_teams: list[str] = Field(
        default_factory=list,
        description="Team slugs allowed to use this agent. Empty list means available to all.",
    )


class AgentList(BaseModel):
    """Response body for the various /agents endpoints."""

    scope: Literal["repo", "org", "enterprise", "service", "all"]
    agents: list[CustomAgent]
    resolution_order: list[Literal["repo", "org", "enterprise", "service"]] = Field(
        default_factory=lambda: ["repo", "org", "enterprise", "service"]
    )


# ---------------------------------------------------------------------------
# Issue listing
# ---------------------------------------------------------------------------


class IssueListItem(BaseModel):
    """Summary of a single GitHub issue in the list response."""

    number: int
    html_url: str
    state: str  # "open" | "closed"
    title: str
    assignees: list[str] = Field(default_factory=list)
    copilot_assigned: bool = False
    custom_agent: str | None = None
    labels: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class IssueListResponse(BaseModel):
    """Response body for GET /repos/{owner}/{repo}/issues."""

    items: list[IssueListItem]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    copilot_bot_login: str
