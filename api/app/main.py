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
from fastapi import Depends, FastAPI, Path
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import Settings, get_settings
from .models import (
    AgentList,
    AssignCopilotRequest,
    CreateAndAssignRequest,
    CreateIssueRequest,
    HealthResponse,
    IssueResponse,
)
from .services import AgentResolver, GitHubClient, IssueService

logger = logging.getLogger("copilot_issue_api")


# ---------------------------------------------------------------------------
# Lifespan: shared httpx.AsyncClient
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    logger.info("Starting copilot-issue-api-v2 v%s", __version__)
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
    "/agents/{owner}/{repo}/all",
    response_model=AgentList,
    tags=["agents"],
    summary="List all agents in resolution order (repo -> org -> enterprise)",
)
async def list_all_agents(
    owner: str,
    repo: str,
    settings: Settings = Depends(get_settings),
    resolver: AgentResolver = Depends(get_resolver),
) -> AgentList:
    enterprise_owner = settings.default_enterprise
    agents = await resolver.list_all(owner, repo, enterprise_owner=enterprise_owner)
    return AgentList(scope="all", agents=agents)
