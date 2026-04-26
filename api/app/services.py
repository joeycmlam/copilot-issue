"""Service layer.

We deliberately keep behaviour minimal — the goal is to *compose* GitHub's
native primitives (Issues + Copilot coding agent + custom-agent profiles in
.github-private) rather than rebuild an orchestration engine. See README for
the mapping from the conceptual diagram to these primitives.

Three concerns are separated:

  * GitHubClient   - low-level HTTP (REST + GraphQL) with auth, errors, retries
  * AgentResolver  - reads .agent.md files at repo / org / enterprise scopes
  * IssueService   - creates issues, renders the body, assigns Copilot
"""

from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import yaml
from fastapi import HTTPException, status

from .config import Settings
from .models import (
    AgentAssignment,
    CreateAndAssignRequest,
    CreateIssueRequest,
    CustomAgent,
    IssueListItem,
    IssueResponse,
    KnowledgeRef,
    SkillRef,
    ToolRef,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class GitHubError(HTTPException):
    """Surface GitHub errors as HTTP errors, preserving status & message."""

    def __init__(self, status_code: int, detail: Any):
        super().__init__(status_code=status_code, detail=detail)


# ---------------------------------------------------------------------------
# GitHubClient
# ---------------------------------------------------------------------------


class GitHubClient:
    """Thin async wrapper over httpx for REST + GraphQL.

    Designed to be created once per request via FastAPI dependency injection;
    reuses the underlying connection pool inside a single request scope.
    """

    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self._settings = settings
        self._client = client

    # -- REST --------------------------------------------------------------

    async def rest(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
    ) -> dict | list | None:
        url = f"{self._settings.github_api_url}{path}"
        resp = await self._client.request(
            method,
            url,
            json=json,
            params=params,
            headers=self._settings.auth_header,
        )
        return self._handle(resp)

    # -- GraphQL -----------------------------------------------------------

    async def graphql(self, query: str, variables: dict | None = None) -> dict:
        resp = await self._client.post(
            self._settings.github_graphql_url,
            json={"query": query, "variables": variables or {}},
            headers=self._settings.graphql_header,
        )
        body = self._handle(resp)
        if isinstance(body, dict) and body.get("errors"):
            raise GitHubError(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"graphql_errors": body["errors"]},
            )
        return body["data"] if isinstance(body, dict) else {}

    # -- Helpers -----------------------------------------------------------

    @staticmethod
    def _handle(resp: httpx.Response) -> Any:
        if resp.status_code == 204:
            return None
        try:
            payload = resp.json()
        except ValueError:
            payload = {"raw": resp.text}
        if resp.is_success:
            return payload
        # 404 on a content lookup (agents missing) is normal — let callers
        # decide how to react. We still raise; the resolver catches it.
        raise GitHubError(status_code=resp.status_code, detail=payload)


# ---------------------------------------------------------------------------
# Agent resolver
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _AgentSource:
    scope: str  # "repo" | "org" | "enterprise"
    owner_repo: str  # the repo where files live
    directory: str  # path inside that repo


class AgentResolver:
    """Discovers `.agent.md` profiles at the three native scopes.

    Repo-level files are stored in the *target* repo at `.github/agents/`.
    Org-level files live in `<org>/.github-private` under `agents/`.
    Enterprise-level files live in the enterprise's `.github-private`
    repository under `agents/` (location varies by enterprise — we expose
    a slug parameter so callers can override).
    """

    REPO_DIR = ".github/agents"
    ORG_REPO = ".github-private"
    ORG_DIR = "agents"
    ENT_DIR = "agents"

    def __init__(self, gh: GitHubClient):
        self._gh = gh

    # -- Public API --------------------------------------------------------

    async def list_repo(self, owner: str, repo: str) -> list[CustomAgent]:
        return await self._list(
            _AgentSource(scope="repo", owner_repo=f"{owner}/{repo}", directory=self.REPO_DIR)
        )

    async def list_org(self, org: str) -> list[CustomAgent]:
        return await self._list(
            _AgentSource(
                scope="org",
                owner_repo=f"{org}/{self.ORG_REPO}",
                directory=self.ORG_DIR,
            )
        )

    async def list_enterprise(self, enterprise_owner: str) -> list[CustomAgent]:
        # GitHub does not expose enterprise-scoped content via the content API
        # directly; convention is that the enterprise owns a `.github-private`
        # repo under an admin org. We accept the OWNER of that repo as the
        # `enterprise_owner` parameter (typically the enterprise admin org).
        return await self._list(
            _AgentSource(
                scope="enterprise",
                owner_repo=f"{enterprise_owner}/{self.ORG_REPO}",
                directory=self.ENT_DIR,
            )
        )

    async def list_all(
        self,
        owner: str,
        repo: str,
        enterprise_owner: str = "",
        store: "AgentStore | None" = None,
        teams: list[str] | None = None,
    ) -> list[CustomAgent]:
        """Resolution order: repo -> org -> enterprise -> service. Earlier wins on name."""

        repo_agents, org_agents, ent_agents = await asyncio.gather(
            self.list_repo(owner, repo),
            self.list_org(owner),
            self.list_enterprise(enterprise_owner) if enterprise_owner else _empty(),
        )

        svc_agents: list[CustomAgent] = store.list_agents(teams) if store else []

        seen: set[str] = set()
        merged: list[CustomAgent] = []
        for batch in (repo_agents, org_agents, ent_agents, svc_agents):
            for a in batch:
                if a.name in seen:
                    continue
                seen.add(a.name)
                merged.append(a)
        return merged

    async def fetch_body(self, source_repo: str, path: str) -> str | None:
        """Fetch the raw text of a single .agent.md file from GitHub."""
        try:
            content = await self._gh.rest(
                "GET",
                f"/repos/{source_repo}/contents/{path}",
            )
        except GitHubError:
            return None
        if not isinstance(content, dict) or content.get("encoding") != "base64":
            return None
        return base64.b64decode(content["content"]).decode("utf-8", errors="replace")

    # -- Internals ---------------------------------------------------------

    async def _list(self, src: _AgentSource) -> list[CustomAgent]:
        try:
            entries = await self._gh.rest(
                "GET",
                f"/repos/{src.owner_repo}/contents/{src.directory}",
            )
        except GitHubError as e:
            if e.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN):
                return []
            raise

        if not isinstance(entries, list):
            return []

        agents: list[CustomAgent] = []
        for entry in entries:
            name = entry.get("name", "")
            if not (name.endswith(".agent.md") or name.endswith(".md")):
                continue
            # Skip README-style files in org/ent agent dirs
            if name.lower() in {"readme.md", "index.md"}:
                continue

            agent = await self._fetch_agent(src, entry)
            if agent is not None:
                agents.append(agent)
        return agents

    async def _fetch_agent(
        self, src: _AgentSource, entry: dict
    ) -> CustomAgent | None:
        try:
            content = await self._gh.rest(
                "GET",
                f"/repos/{src.owner_repo}/contents/{entry['path']}",
            )
        except GitHubError:
            return None

        if not isinstance(content, dict) or content.get("encoding") != "base64":
            return None

        raw = base64.b64decode(content["content"]).decode("utf-8", errors="replace")
        meta, _body = _split_frontmatter(raw)

        agent_name = entry["name"].removesuffix(".agent.md").removesuffix(".md")
        return CustomAgent(
            name=meta.get("name", agent_name),
            scope=src.scope,  # type: ignore[arg-type]
            source_repo=src.owner_repo,
            path=entry["path"],
            description=meta.get("description"),
            tools=list(meta.get("tools", []) or []),
            handoffs=list(meta.get("handoffs", []) or []),
            target=meta.get("target", "any"),
        )


async def _empty() -> list[CustomAgent]:
    return []


# ---------------------------------------------------------------------------
# Service-level agent store
# ---------------------------------------------------------------------------

_AGENTS_DIR = Path(__file__).parent.parent / "agents"


class AgentStore:
    """Serves `.agent.md` files bundled with the API service.

    Files live under ``api/agents/`` in the repo.  Any file whose YAML
    frontmatter contains an ``allowed_teams`` list is restricted to callers
    whose team membership intersects that list.  An absent or empty
    ``allowed_teams`` makes the agent visible to everyone.
    """

    def __init__(self, agents_dir: Path = _AGENTS_DIR):
        self._dir = agents_dir

    def list_agents(self, teams: list[str] | None = None) -> list[CustomAgent]:
        """Return all service agents the caller is allowed to see.

        ``teams`` is the caller's team slug list (e.g. ``["platform", "qa"]``).
        Pass ``None`` or ``[]`` to get only public (unrestricted) agents.
        """
        caller_teams = set(teams or [])
        agents: list[CustomAgent] = []
        if not self._dir.is_dir():
            return agents
        # Collect all .agent.md and .md files; .agent.md takes priority on
        # name collisions (same resolution order as AgentResolver).
        _seen_names: set[str] = set()
        _all_paths = sorted(
            {*self._dir.rglob("*.agent.md"), *self._dir.rglob("*.md")}
        )
        # Sort so .agent.md files come first (they win on name collision).
        _all_paths.sort(key=lambda p: (0 if p.name.endswith(".agent.md") else 1, p))
        for path in _all_paths:
            if path.name.lower() in {"readme.md", "index.md"}:
                continue
            try:
                raw = path.read_text(encoding="utf-8")
            except OSError:
                continue
            meta, _body = _split_frontmatter(raw)
            allowed: list[str] = list(meta.get("allowed_teams", []) or [])
            if allowed and not caller_teams.intersection(allowed):
                continue
            agent_name = path.stem.removesuffix(".agent")
            resolved_name = meta.get("name", agent_name)
            if resolved_name in _seen_names:
                continue
            _seen_names.add(resolved_name)
            agents.append(
                CustomAgent(
                    name=resolved_name,
                    scope="service",
                    source_repo="(built-in)",
                    path=str(path.relative_to(self._dir)),
                    description=meta.get("description"),
                    tools=list(meta.get("tools", []) or []),
                    handoffs=list(meta.get("handoffs", []) or []),
                    target=meta.get("target", "any"),
                    allowed_teams=allowed,
                )
            )
        return agents

    def get_body(self, path: str) -> str | None:
        """Return raw text of a service-level .agent.md file (disk read)."""
        target = (self._dir / path).resolve()
        # Guard against path traversal outside the agents directory.
        try:
            target.relative_to(self._dir.resolve())
        except ValueError:
            return None
        try:
            return target.read_text(encoding="utf-8")
        except OSError:
            return None


def _split_frontmatter(text: str) -> tuple[dict, str]:
    """Parse a `---`-delimited YAML frontmatter block. Tolerant of malformed."""

    if not text.startswith("---"):
        return {}, text
    try:
        _, fm, body = text.split("---", 2)
        meta = yaml.safe_load(fm) or {}
        if not isinstance(meta, dict):
            meta = {}
        return meta, body
    except (ValueError, yaml.YAMLError):
        return {}, text


# ---------------------------------------------------------------------------
# Body rendering — Copilot directives block
# ---------------------------------------------------------------------------


_DIRECTIVES_HEADER = "<!-- copilot-issue-api-v2: directives -->"
_DIRECTIVES_FOOTER = "<!-- /copilot-issue-api-v2 -->"


def render_issue_body(
    prompt: str,
    skills: list[SkillRef],
    tools: list[ToolRef],
    knowledge_refs: list[KnowledgeRef],
) -> str:
    """Render the full issue body.

    The body is composed so the Copilot coding agent — guided by its
    `.agent.md` profile — has explicit, structured directives without any
    server-side orchestration runtime. The agent profile decides how to
    react to these directives (which tools to bind, which RAG sources to
    query, etc.).
    """

    sections: list[str] = [prompt.rstrip()]

    if not (skills or tools or knowledge_refs):
        return sections[0] + "\n"

    block: list[str] = [_DIRECTIVES_HEADER, "", "## Copilot directives", ""]

    if skills:
        block.append("**Skills** (from the firm skill registry):")
        block.extend(
            f"- `{s.name}`" + (f" @ `{s.version}`" if s.version else "")
            for s in skills
        )
        block.append("")

    if tools:
        block.append("**Tools**:")
        block.extend(f"- `{t.name}` ({t.type})" for t in tools)
        block.append("")

    if knowledge_refs:
        block.append("**Knowledge references** (RAG sources to ground on):")
        for k in knowledge_refs:
            block.append(f"- `{k.kind}`: {k.value}")
        block.append("")

    block.append(_DIRECTIVES_FOOTER)
    sections.append("\n".join(block))
    return "\n\n".join(sections) + "\n"


# ---------------------------------------------------------------------------
# IssueService
# ---------------------------------------------------------------------------


class IssueService:
    """High-level operations: create issues, assign Copilot, do both.

    All Copilot-specific behaviour goes through GitHub's documented REST
    surface (`/repos/{o}/{r}/issues` with `agent_assignment`,
    `/repos/{o}/{r}/issues/{n}/assignees` with the same key) so we
    automatically inherit GitHub's resolution of `custom_agent` across
    repo / org / enterprise scopes.
    """

    def __init__(self, gh: GitHubClient, settings: Settings):
        self._gh = gh
        self._settings = settings

    # -- Create ------------------------------------------------------------

    async def create_issue(
        self,
        owner: str,
        repo: str,
        body: CreateIssueRequest,
        *,
        assign_copilot: bool = False,
        agent: AgentAssignment | None = None,
    ) -> IssueResponse:
        rendered = render_issue_body(
            body.prompt, body.skills, body.tools, body.knowledge_refs
        )

        assignees = list(body.assignees)
        agent_assignment_payload: dict | None = None

        if assign_copilot:
            if self._settings.copilot_bot_login not in assignees:
                assignees.append(self._settings.copilot_bot_login)
            agent_assignment_payload = self._agent_payload(owner, repo, agent)

        payload: dict[str, Any] = {
            "title": body.title,
            "body": rendered,
            "labels": body.labels,
            "assignees": assignees,
        }
        if body.milestone is not None:
            payload["milestone"] = body.milestone
        if agent_assignment_payload is not None:
            payload["agent_assignment"] = agent_assignment_payload

        result = await self._gh.rest(
            "POST",
            f"/repos/{owner}/{repo}/issues",
            json=payload,
        )
        return self._to_response(
            result,  # type: ignore[arg-type]
            agent=agent if assign_copilot else None,
            copilot_assigned=assign_copilot,
        )

    # -- Assign Copilot to existing issue ---------------------------------

    async def assign_copilot(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        agent: AgentAssignment,
        *,
        keep_existing_assignees: bool = True,
    ) -> IssueResponse:
        agent_payload = self._agent_payload(owner, repo, agent)

        if keep_existing_assignees:
            # POST /assignees appends; ideal when humans + Copilot share the issue.
            result = await self._gh.rest(
                "POST",
                f"/repos/{owner}/{repo}/issues/{issue_number}/assignees",
                json={
                    "assignees": [self._settings.copilot_bot_login],
                    "agent_assignment": agent_payload,
                },
            )
        else:
            # PATCH /issues/{n} replaces the full assignee list.
            result = await self._gh.rest(
                "PATCH",
                f"/repos/{owner}/{repo}/issues/{issue_number}",
                json={
                    "assignees": [self._settings.copilot_bot_login],
                    "agent_assignment": agent_payload,
                },
            )

        return self._to_response(
            result,  # type: ignore[arg-type]
            agent=agent,
            copilot_assigned=True,
        )

    # -- Combined ---------------------------------------------------------

    async def create_and_assign(
        self,
        owner: str,
        repo: str,
        body: CreateAndAssignRequest,
    ) -> IssueResponse:
        return await self.create_issue(
            owner,
            repo,
            CreateIssueRequest(**body.model_dump(exclude={"agent"})),
            assign_copilot=True,
            agent=body.agent,
        )

    # -- List issues assigned to Copilot ----------------------------------

    async def list_issues(
        self,
        owner: str,
        repo: str,
        *,
        state: str = "all",
        per_page: int = 50,
    ) -> list[IssueListItem]:
        """Return issues assigned to the Copilot bot login."""
        result = await self._gh.rest(
            "GET",
            f"/repos/{owner}/{repo}/issues",
            params={
                "assignee": self._settings.copilot_bot_login,
                "state": state,
                "per_page": min(per_page, 100),
            },
        )
        if not isinstance(result, list):
            return []
        items: list[IssueListItem] = []
        for issue in result:
            assignees = [a.get("login", "") for a in issue.get("assignees", [])]
            labels = [lbl.get("name", "") for lbl in issue.get("labels", [])]
            # Best-effort: extract custom_agent from the issue body directives
            # block; fall back to None when absent.
            custom_agent: str | None = None
            body_text = issue.get("body") or ""
            for line in body_text.splitlines():
                if line.startswith("custom_agent:"):
                    custom_agent = line.split(":", 1)[1].strip() or None
                    break
            items.append(
                IssueListItem(
                    number=issue["number"],
                    html_url=issue.get("html_url", ""),
                    state=issue.get("state", "open"),
                    title=issue.get("title", ""),
                    assignees=assignees,
                    copilot_assigned=self._settings.copilot_bot_login in assignees,
                    custom_agent=custom_agent,
                    labels=labels,
                    created_at=issue.get("created_at"),
                    updated_at=issue.get("updated_at"),
                )
            )
        return items

    # -- Internals --------------------------------------------------------

    def _agent_payload(
        self, owner: str, repo: str, agent: AgentAssignment | None
    ) -> dict:
        """Build the `agent_assignment` block for REST.

        We always supply *all* keys (with sensible defaults) — the REST API
        is happier with empty strings than with missing keys.
        """

        a = agent or AgentAssignment()
        return {
            "target_repo": a.target_repo or f"{owner}/{repo}",
            "base_branch": a.base_branch or self._settings.default_base_branch,
            "custom_instructions": a.custom_instructions or "",
            "custom_agent": a.custom_agent or "",
            "model": a.model or "",
        }

    def _to_response(
        self,
        gh_payload: dict,
        *,
        agent: AgentAssignment | None,
        copilot_assigned: bool,
    ) -> IssueResponse:
        assignees = [a.get("login", "") for a in gh_payload.get("assignees", [])]
        return IssueResponse(
            number=gh_payload["number"],
            id=gh_payload.get("id"),
            node_id=gh_payload.get("node_id"),
            html_url=gh_payload.get("html_url", ""),
            state=gh_payload.get("state", "open"),
            title=gh_payload.get("title", ""),
            assignees=assignees,
            copilot_assigned=copilot_assigned
            or self._settings.copilot_bot_login in assignees,
            custom_agent=(agent.custom_agent if agent else None) or None,
            target_repo=(agent.target_repo if agent else None),
            base_branch=(agent.base_branch if agent else None),
        )
