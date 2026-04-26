"""Runtime configuration loaded from environment / .env file.

We deliberately keep this thin: the service is a stateless wrapper around the
GitHub REST + GraphQL APIs, so there is no database, no cache, no broker. The
only required configuration is a token with sufficient scope.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service-wide configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Auth --------------------------------------------------------------
    github_token: str = Field(
        ...,
        description=(
            "PAT with `repo`, `read:org`, optionally `admin:enterprise`. "
            "Must belong to a user with Copilot coding agent access."
        ),
    )

    # -- Endpoints ---------------------------------------------------------
    github_api_url: str = Field(
        default="https://api.github.com",
        description="REST API base URL. Override for GHES.",
    )
    github_graphql_url: str = Field(
        default="https://api.github.com/graphql",
        description="GraphQL endpoint. Override for GHES.",
    )

    # -- Copilot agent -----------------------------------------------------
    copilot_bot_login: str = Field(
        default="copilot-swe-agent[bot]",
        description="Login of the Copilot coding agent bot.",
    )
    default_base_branch: str = Field(
        default="main",
        description="Base branch used when the caller omits one.",
    )
    default_enterprise: str = Field(
        default="",
        description="Enterprise slug used when caller omits one. Empty disables.",
    )

    # -- HTTP --------------------------------------------------------------
    http_timeout_seconds: float = Field(default=30.0, ge=1.0, le=300.0)

    # -- Observability -----------------------------------------------------
    log_level: str = Field(default="INFO")
    log_dir: str = Field(
        default="logs",
        description=(
            "Directory for rotating log files (relative to the working directory). "
            "Files are rotated daily; set to empty string to disable file logging."
        ),
    )

    # -- Derived helpers ---------------------------------------------------
    @property
    def auth_header(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "copilot-issue-api-v2",
        }

    @property
    def graphql_header(self) -> dict[str, str]:
        # The Copilot agent assignment fields require this preview header.
        # See: https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/
        return {
            **self.auth_header,
            "GraphQL-Features": (
                "issues_copilot_assignment_api_support,coding_agent_model_selection"
            ),
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor; cached so .env is parsed once per process."""

    return Settings()  # type: ignore[call-arg]
