# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Build stage
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false

RUN pip install "poetry==${POETRY_VERSION}"

WORKDIR /build
COPY pyproject.toml ./
# Lock-free install (dependencies are pinned with caret ranges in pyproject)
RUN poetry install --only=main --no-root --no-interaction --no-ansi

# -----------------------------------------------------------------------------
# Runtime stage
# -----------------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root user
RUN useradd --create-home --shell /usr/sbin/nologin app
WORKDIR /app

# Bring the installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Application source
COPY app ./app
COPY pyproject.toml README.md ./

USER app

EXPOSE 8000

# Health probe: docker run --health-cmd "curl -f http://localhost:8000/health"
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
