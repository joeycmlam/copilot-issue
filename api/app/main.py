"""FastAPI application — endpoints exactly as documented in README.md.

The service is a thin facade over GitHub's native Issue + Copilot coding
agent + custom-agent surfaces. We do not run any orchestration runtime; the
GitHub Issue is the work unit, the Copilot agent is the executor, and the
agent's `.agent.md` profile (resolved repo -> org -> enterprise) is the
'how'. See README.md for the mapping to the conceptual architecture.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import Depends, FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import Settings, get_settings
from .models import (
    AgentBodyResponse,
    AgentList,
    AssignCopilotRequest,
    CreateAndAssignRequest,
    CreateIssueRequest,
    HealthResponse,
    IssueListResponse,
    IssueResponse,
)
from .services import AgentResolver, AgentStore, GitHubClient, IssueService

logger = logging.getLogger("copilot_issue_api")


# ---------------------------------------------------------------------------
# Lifespan: shared httpx.AsyncClient
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    logger.info("Starting copilot-issue-api-v2 v%s", __version__)
    token = settings.github_token.strip()
    token_loaded = bool(token)
    token_kind = (
        "fine-grained-pat"
        if token.startswith("github_pat_")
        else ("classic-pat" if token.startswith("ghp_") else "other")
    )
    logger.info(
        "GitHub token loaded=%s kind=%s length=%d",
        token_loaded,
        token_kind,
        len(token),
    )
    if not token_loaded:
        logger.warning(
            "GITHUB_TOKEN appears empty. Set it in api/.env and restart the server."
        )
    timeout = httpx.Timeout(settings.http_timeout_seconds)
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=100)
    app.state.http = httpx.AsyncClient(timeout=timeout, limits=limits)
    try:
        yield
    finally:
        await app.state.http.aclose()


app = FastAPI(
    title="GitHub Copilot Issue Assignment API",
    version=__version__,
    description=(
        "Create GitHub Issues and assign them to the Copilot coding agent "
        "(`copilot-swe-agent[bot]`). Custom agents are reusable across the "
        "organisation via `<org>/.github-private` — pass only the agent "
        "**name**, GitHub resolves the level (repo → org → enterprise)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------


def _http_client() -> httpx.AsyncClient:
    return app.state.http


def get_gh(
    settings: Settings = Depends(get_settings),
) -> GitHubClient:
    return GitHubClient(settings, _http_client())


def get_issue_service(
    gh: GitHubClient = Depends(get_gh),
    settings: Settings = Depends(get_settings),
) -> IssueService:
    return IssueService(gh, settings)


def get_resolver(gh: GitHubClient = Depends(get_gh)) -> AgentResolver:
    return AgentResolver(gh)


def get_store() -> AgentStore:
    return AgentStore()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(version=__version__, copilot_bot_login=settings.copilot_bot_login)


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------


@app.post(
    "/repos/{owner}/{repo}/issues",
    response_model=IssueResponse,
    tags=["issues"],
    summary="Create an issue from a prompt",
)
async def create_issue(
    body: CreateIssueRequest,
    owner: str = Path(..., examples=["acme"]),
    repo: str = Path(..., examples=["payments-service"]),
    svc: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    """Create a GitHub Issue with rendered Copilot directives in the body.

    Does NOT assign Copilot. Use `/assign-copilot` or `/create-and-assign`
    for that.
    """

    return await svc.create_issue(owner, repo, body)


@app.post(
    "/repos/{owner}/{repo}/issues/{issue_number}/assign-copilot",
    response_model=IssueResponse,
    tags=["issues"],
    summary="Assign an existing issue to Copilot + a custom agent",
)
async def assign_copilot(
    body: AssignCopilotRequest,
    owner: str = Path(...),
    repo: str = Path(...),
    issue_number: int = Path(..., ge=1),
    svc: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    """Assign `copilot-swe-agent[bot]` and forward `agent_assignment`.

    GitHub itself resolves `custom_agent` across repo / org / enterprise
    `.agent.md` profiles. We pass the name through unchanged.
    """

    return await svc.assign_copilot(
        owner,
        repo,
        issue_number,
        body.agent,
        keep_existing_assignees=body.keep_existing_assignees,
    )


@app.post(
    "/repos/{owner}/{repo}/issues/create-and-assign",
    response_model=IssueResponse,
    tags=["issues"],
    summary="Create an issue and assign it to Copilot in one call",
)
async def create_and_assign(
    body: CreateAndAssignRequest,
    owner: str = Path(...),
    repo: str = Path(...),
    svc: IssueService = Depends(get_issue_service),
) -> IssueResponse:
    return await svc.create_and_assign(owner, repo, body)


@app.get(
    "/repos/{owner}/{repo}/issues",
    response_model=IssueListResponse,
    tags=["issues"],
    summary="List issues assigned to the Copilot agent",
)
async def list_issues(
    owner: str = Path(...),
    repo: str = Path(...),
    state: str = "all",
    per_page: int = 50,
    svc: IssueService = Depends(get_issue_service),
) -> IssueListResponse:
    """Return GitHub issues in the repo that are assigned to the Copilot bot.

    `state` is forwarded to GitHub: ``open`` | ``closed`` | ``all`` (default).
    """
    items = await svc.list_issues(owner, repo, state=state, per_page=per_page)
    return IssueListResponse(items=items)


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


@app.get(
    "/agents/repo/{owner}/{repo}",
    response_model=AgentList,
    tags=["agents"],
    summary="List repo-scoped custom agents",
)
async def list_repo_agents(
    owner: str,
    repo: str,
    resolver: AgentResolver = Depends(get_resolver),
) -> AgentList:
    agents = await resolver.list_repo(owner, repo)
    return AgentList(scope="repo", agents=agents)


@app.get(
    "/agents/org/{org}",
    response_model=AgentList,
    tags=["agents"],
    summary="List org-scoped custom agents (from <org>/.github-private)",
)
async def list_org_agents(
    org: str,
    resolver: AgentResolver = Depends(get_resolver),
) -> AgentList:
    agents = await resolver.list_org(org)
    return AgentList(scope="org", agents=agents)


@app.get(
    "/agents/enterprise/{enterprise_owner}",
    response_model=AgentList,
    tags=["agents"],
    summary="List enterprise-scoped custom agents",
    description=(
        "`enterprise_owner` is the OWNER of the enterprise's `.github-private`"
        " repository (typically the enterprise admin org)."
    ),
)
async def list_enterprise_agents(
    enterprise_owner: str,
    resolver: AgentResolver = Depends(get_resolver),
) -> AgentList:
    agents = await resolver.list_enterprise(enterprise_owner)
    return AgentList(scope="enterprise", agents=agents)


@app.get(
    "/agents/service",
    response_model=AgentList,
    tags=["agents"],
    summary="List service-level custom agents bundled with the API",
    description=(
        "Returns `.agent.md` files shipped inside the `api/agents/` directory. "
        "Pass `?teams=team1,team2` to include agents restricted to those teams. "
        "Agents with no `allowed_teams` restriction are always returned."
    ),
)
async def list_service_agents(
    teams: str = "",
    store: AgentStore = Depends(get_store),
) -> AgentList:
    team_list = [t.strip() for t in teams.split(",") if t.strip()] if teams else []
    agents = store.list_agents(team_list)
    return AgentList(scope="service", agents=agents)


@app.post(
    "/agents/service/refresh",
    response_model=AgentList,
    tags=["agents"],
    summary="Force-refresh the service-level custom agent list",
    description=(
        "Re-reads the `api/agents/` directory from disk and returns the current "
        "list of bundled `.agent.md` files. Use this after adding, updating, or "
        "removing a service agent without restarting the API. "
        "Pass `?teams=team1,team2` to include team-restricted agents."
    ),
)
async def refresh_service_agents(
    teams: str = "",
    store: AgentStore = Depends(get_store),
) -> AgentList:
    team_list = [t.strip() for t in teams.split(",") if t.strip()] if teams else []
    agents = store.list_agents(team_list)
    return AgentList(scope="service", agents=agents)


@app.get(
    "/agents/{owner}/{repo}/all",
    response_model=AgentList,
    tags=["agents"],
    summary="List all agents in resolution order (repo -> org -> enterprise -> service)",
)
async def list_all_agents(
    owner: str,
    repo: str,
    teams: str = "",
    settings: Settings = Depends(get_settings),
    resolver: AgentResolver = Depends(get_resolver),
    store: AgentStore = Depends(get_store),
) -> AgentList:
    enterprise_owner = settings.default_enterprise
    team_list = [t.strip() for t in teams.split(",") if t.strip()] if teams else []
    agents = await resolver.list_all(
        owner, repo, enterprise_owner=enterprise_owner, store=store, teams=team_list
    )
    return AgentList(scope="all", agents=agents)


@app.get(
    "/agents/content",
    response_model=AgentBodyResponse,
    tags=["agents"],
    summary="Fetch the raw .agent.md file content",
    description=(
        "Returns the full raw text (YAML frontmatter + markdown body) of a single "
        "agent profile. Pass `scope`, `source_repo`, and `path` as query parameters "
        "(values are returned in the agent listing endpoints)."
    ),
)
async def get_agent_content(
    scope: str,
    source_repo: str,
    path: str,
    resolver: AgentResolver = Depends(get_resolver),
    store: AgentStore = Depends(get_store),
) -> AgentBodyResponse:
    name = path.rsplit("/", 1)[-1].removesuffix(".agent.md").removesuffix(".md")
    if scope == "service":
        body = store.get_body(path)
    else:
        body = await resolver.fetch_body(source_repo, path)
    if body is None:
        raise HTTPException(status_code=404, detail="Agent file not found")
    return AgentBodyResponse(name=name, scope=scope, body=body)


@app.post(
    "/agents/{owner}/{repo}/refresh",
    response_model=AgentList,
    tags=["agents"],
    summary="Force-refresh the full agents list from all sources",
    description=(
        "Re-fetches agent profiles from all scopes (repo → org → enterprise → service) "
        "and returns the merged, deduplicated list. Use this after publishing or updating "
        "an `.agent.md` file to pick up the changes immediately. "
        "Pass `?teams=team1,team2` to include team-restricted service agents."
    ),
)
async def refresh_agents(
    owner: str,
    repo: str,
    teams: str = "",
    settings: Settings = Depends(get_settings),
    resolver: AgentResolver = Depends(get_resolver),
    store: AgentStore = Depends(get_store),
) -> AgentList:
    enterprise_owner = settings.default_enterprise
    team_list = [t.strip() for t in teams.split(",") if t.strip()] if teams else []
    agents = await resolver.list_all(
        owner, repo, enterprise_owner=enterprise_owner, store=store, teams=team_list
    )
    return AgentList(scope="all", agents=agents)
