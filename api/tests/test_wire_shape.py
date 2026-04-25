"""Verify the exact JSON shape we send to GitHub matches the changelog spec.

Reference: https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.config import Settings
from app.models import (
    AgentAssignment,
    CreateAndAssignRequest,
    SkillRef,
    ToolRef,
)
from app.services import GitHubClient, IssueService


@pytest.mark.asyncio
async def test_create_and_assign_sends_agent_assignment_block():
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["json"] = json.loads(request.content)
        return httpx.Response(
            201,
            json={
                "number": 99,
                "id": 12345,
                "node_id": "I_kwDOABCDEF",
                "html_url": "https://github.com/acme/payments/issues/99",
                "state": "open",
                "title": "T",
                "assignees": [{"login": "copilot-swe-agent[bot]"}],
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        settings = Settings(github_token="ghp_test")  # type: ignore[call-arg]
        gh = GitHubClient(settings, client)
        svc = IssueService(gh, settings)
        body = CreateAndAssignRequest(
            title="T",
            prompt="story",
            skills=[SkillRef(name="code-generation")],
            tools=[ToolRef(name="github", type="builtin")],
            agent=AgentAssignment(
                custom_agent="backend-agent",
                custom_instructions="Follow ADR 0007.",
            ),
        )
        resp = await svc.create_and_assign("acme", "payments", body)

    # Endpoint
    assert captured["url"].endswith("/repos/acme/payments/issues")

    # Required headers
    assert captured["headers"]["accept"] == "application/vnd.github+json"
    assert captured["headers"]["x-github-api-version"] == "2022-11-28"
    assert captured["headers"]["authorization"].startswith("Bearer ")

    # Wire shape per the GitHub changelog
    payload = captured["json"]
    assert payload["title"] == "T"
    assert "copilot-swe-agent[bot]" in payload["assignees"]
    assert payload["agent_assignment"] == {
        "target_repo": "acme/payments",
        "base_branch": "main",
        "custom_instructions": "Follow ADR 0007.",
        "custom_agent": "backend-agent",
        "model": "",
    }
    # Body should embed the directives block
    assert "Copilot directives" in payload["body"]
    assert "code-generation" in payload["body"]

    # Response surface
    assert resp.number == 99
    assert resp.copilot_assigned is True
    assert resp.custom_agent == "backend-agent"
