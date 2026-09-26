"""Diagnostics from committed collection checkpoints, with no provider calls."""

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.contracts.data_sources import (
    CrawlLogEntry,
    DataSourcesSnapshot,
    DataSourceSummary,
    SourceRuntime,
)
from app.db import get_session
from app.models.research import ResearchRun

router = APIRouter(tags=["data-sources"])


@router.get("/data-sources", response_model=DataSourcesSnapshot)
def get_data_sources(
    limit: int = Query(default=100, ge=1, le=250),
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> DataSourcesSnapshot:
    # Select only log metadata, never normalized documents. Bound database work
    # to the latest 250 runs with telemetry, including checkpoints in active runs.
    saved_log = ResearchRun.stage_results["collection"]["crawl_log"]
    rows = session.execute(
        select(saved_log.as_json())
        .where(saved_log.as_string().is_not(None))
        .order_by(ResearchRun.queued_at.desc(), ResearchRun.id.desc())
        .limit(250)
    )
    entries: list[CrawlLogEntry] = []
    for (saved,) in rows:
        if not isinstance(saved, list):
            continue
        for item in saved:
            try:
                entries.append(CrawlLogEntry.model_validate(item))
            except ValidationError:
                continue  # Ignore incompatible historical metadata; never invent records.
    entries.sort(key=lambda entry: (entry.at, entry.id), reverse=True)
    entries = entries[:limit]
    sources = [
        DataSourceSummary(
            id="gdelt",
            name="GDELT",
            configured=True,
            description="Public news discovery; article URLs are collected separately.",
        ),
        DataSourceSummary(
            id="newsapi",
            name="NewsAPI",
            configured=bool(settings.newsapi_key),
            description="Supplementary news discovery alongside GDELT when configured.",
        ),
        DataSourceSummary(
            id="websites",
            name="Public websites",
            configured=True,
            description="Company pages, reports, careers and discovered news articles.",
        ),
    ]
    for source in sources:
        matching = [entry for entry in entries if entry.provider == source.id]
        source.attempts = sum(entry.status != "skipped" for entry in matching)
        source.succeeded = sum(entry.status == "ok" for entry in matching)
        source.failed = sum(entry.status == "error" for entry in matching)
        attempted = [entry.at for entry in matching if entry.status != "skipped"]
        source.last_attempt_at = max(attempted, default=None)
    return DataSourcesSnapshot(
        sources=sources,
        crawl_log=entries,
        runtime=SourceRuntime(
            assessment_model=settings.assessment_model,
            assessment_configured=bool(settings.assessment_model and settings.openrouter_api_key),
            newsapi_configured=bool(settings.newsapi_key),
            browser_rendering_enabled=settings.browser_rendering_enabled,
            source_text_retention_days=settings.source_text_retention_days,
            worker_concurrency=settings.worker_concurrency,
        ),
    )
