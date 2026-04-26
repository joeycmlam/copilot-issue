"""Logging configuration for the copilot-issue-api service.

Sets up two handlers:
  - StreamHandler  — always-on console output
  - TimedRotatingFileHandler — daily log files under ``log_dir/``,
    named ``api-YYYY-MM-DD.log`` (the handler appends the date suffix on
    rotation; the active file is always ``api.log``).

Call :func:`configure_logging` once during application startup.
"""

from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path


_LOG_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


def configure_logging(level: str = "INFO", log_dir: str = "logs") -> None:
    """Configure the root logger with a console handler and (optionally) a
    daily-rotating file handler.

    Parameters
    ----------
    level:
        Minimum log level string, e.g. ``"DEBUG"``, ``"INFO"``.
    log_dir:
        Directory path for log files.  Pass an empty string to disable file
        logging (useful in containerised environments that capture stdout).
    """

    numeric_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)

    root = logging.getLogger()
    # Avoid adding duplicate handlers if configure_logging is called more
    # than once (e.g. during hot-reload cycles).
    root.handlers.clear()
    root.setLevel(numeric_level)

    # -- Console handler ---------------------------------------------------
    console = logging.StreamHandler()
    console.setLevel(numeric_level)
    console.setFormatter(formatter)
    root.addHandler(console)

    # -- Daily-rotating file handler --------------------------------------
    if log_dir:
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.TimedRotatingFileHandler(
            filename=log_path / "api.log",
            when="midnight",
            interval=1,
            backupCount=30,          # keep 30 days of history
            encoding="utf-8",
            utc=True,                # rotate at UTC midnight for consistency
        )
        # Suffix gives rotated files names like api.log.2026-04-26
        file_handler.suffix = "%Y-%m-%d"
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
        logging.getLogger("copilot_issue_api").info(
            "File logging enabled — directory=%s backupCount=30 utc=True", log_path.resolve()
        )

    # Silence overly verbose third-party loggers at WARNING so they don't
    # flood the log files.
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(max(numeric_level, logging.WARNING))
