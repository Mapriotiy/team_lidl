"""Read-only source diagnostics; counts summarize the returned log window."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CrawlLogEntry(BaseModel):
    id: str
    run_id: str
    company_id: str
    company_name: str
    provider: Literal["gdelt", "newsapi", "websites"]
    target: str
    status: Literal["ok", "error", "skipped"]
    detail: str
    at: datetime
    documents: int | None = Field(default=None, ge=0)


class DataSourceSummary(BaseModel):
    id: str
    name: str
    description: str
    configured: bool
    attempts: int = 0
    succeeded: int = 0
    failed: int = 0
    last_attempt_at: datetime | None = None


class SourceRuntime(BaseModel):
    assessment_model: str | None
    assessment_configured: bool
    newsapi_configured: bool
    browser_rendering_enabled: bool
    source_text_retention_days: int
    worker_concurrency: int


class DataSourcesSnapshot(BaseModel):
    sources: list[DataSourceSummary]
    crawl_log: list[CrawlLogEntry]
    runtime: SourceRuntime
