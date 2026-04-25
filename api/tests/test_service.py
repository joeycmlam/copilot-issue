"""Unit tests for body rendering and the agent payload builder.

These tests deliberately do NOT hit GitHub — they exercise the pieces we own.
For end-to-end testing point a local instance at a sandbox repo.
"""

from __future__ import annotations

from app.config import Settings
from app.models import (
    AgentAssignment,
    KnowledgeRef,
    SkillRef,
    ToolRef,
)
from app.services import IssueService, render_issue_body


def _settings() -> Settings:
    return Settings(github_token="ghp_test")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# render_issue_body
# ---------------------------------------------------------------------------


def test_render_issue_body_without_directives_returns_just_the_prompt():
    body = render_issue_body("Hello world", [], [], [])
    assert body.strip() == "Hello world"
    assert "copilot-issue-api-v2" not in body


def test_render_issue_body_includes_all_directive_sections():
    body = render_issue_body(
        "## Story\nDo the thing.",
        skills=[
            SkillRef(name="code-generation", version="1.4.0"),
            SkillRef(name="test-generation"),
        ],
        tools=[ToolRef(name="github", type="builtin"), ToolRef(name="kql-adx")],
        knowledge_refs=[
            KnowledgeRef(kind="repo_path", value="docs/adr/0007.md"),
            KnowledgeRef(kind="url", value="https://example.com/spec"),
        ],
    )

    assert "Do the thing." in body
    assert "<!-- copilot-issue-api-v2: directives -->" in body
    assert "<!-- /copilot-issue-api-v2 -->" in body
    assert "`code-generation` @ `1.4.0`" in body
    assert "`test-generation`" in body
    assert "`github` (builtin)" in body
    assert "`kql-adx` (mcp)" in body
    assert "`repo_path`: docs/adr/0007.md" in body
    assert "`url`: https://example.com/spec" in body


# ---------------------------------------------------------------------------
# IssueService._agent_payload
# ---------------------------------------------------------------------------


def test_agent_payload_defaults_to_caller_repo_and_default_branch():
    settings = _settings()
    svc = IssueService(gh=None, settings=settings)  # type: ignore[arg-type]

    payload = svc._agent_payload("acme", "payments", AgentAssignment())

    assert payload == {
        "target_repo": "acme/payments",
        "base_branch": settings.default_base_branch,
        "custom_instructions": "",
        "custom_agent": "",
        "model": "",
    }


def test_agent_payload_passes_custom_agent_through_unchanged():
    settings = _settings()
    svc = IssueService(gh=None, settings=settings)  # type: ignore[arg-type]

    payload = svc._agent_payload(
        "acme",
        "payments",
        AgentAssignment(
            custom_agent="backend-agent",
            base_branch="release/v2",
            custom_instructions="Follow ADR 0007.",
            target_repo="acme/payments-fork",
            model="claude-sonnet-4",
        ),
    )

    assert payload["custom_agent"] == "backend-agent"
    assert payload["base_branch"] == "release/v2"
    assert payload["custom_instructions"] == "Follow ADR 0007."
    assert payload["target_repo"] == "acme/payments-fork"
    assert payload["model"] == "claude-sonnet-4"
