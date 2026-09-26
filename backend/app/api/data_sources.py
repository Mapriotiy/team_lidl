"""Diagnostics from committed collection checkpoints, with no provider calls."""

from datetime import UTC

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collection.observability import safe_target
from app.config import Settings, get_settings
from app.contracts.data_sources import (
    CrawlLogEntry,
    DataSourcesSnapshot,
    DataSourceSummary,
    SourceRuntime,
)
from app.db import get_session
from app.models.research import Company, ResearchRun
from app.models.results import StoredSourceDocument

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
    # Legacy source rows prove that text was collected, but do not prove which
    # news provider found the URL, nor previous failed attempts or redirect chains.
    # Derive read-only activity with explicit provenance; do not backfill run logs.
    # Exclude in-flight runs so a newly saved page is not mistaken for old history
    # before the collector's lease-fenced checkpoint has committed.
    historical = session.execute(
        select(
            StoredSourceDocument.id,
            StoredSourceDocument.research_run_id,
            StoredSourceDocument.company_id,
            Company.display_name,
            StoredSourceDocument.canonical_url,
            StoredSourceDocument.retrieved_at,
        )
        .join(ResearchRun, ResearchRun.id == StoredSourceDocument.research_run_id)
        .join(Company, Company.id == StoredSourceDocument.company_id)
        .where(
            saved_log.as_string().is_(None),
            ResearchRun.status.in_(("completed", "partial", "failed")),
        )
        .order_by(StoredSourceDocument.retrieved_at.desc(), StoredSourceDocument.id.desc())
        .limit(limit)
    )
    for source_id, run_id, company_id, company_name, url, retrieved_at in historical:
        # PostgreSQL preserves timezone information; SQLite test databases do not.
        at = retrieved_at if retrieved_at.tzinfo else retrieved_at.replace(tzinfo=UTC)
        entries.append(
            CrawlLogEntry(
                id=f"stored-source:{source_id}",
                run_id=run_id,
                company_id=company_id,
                company_name=company_name,
                provider="websites",
                target=safe_target(url),
                status="ok",
                detail="Historical stored source; original crawl trace unavailable",
                at=at,
                documents=1,
                provenance="stored_source",
            )
        )
    entries.sort(key=lambda entry: (entry.at, entry.id), reverse=True)
    newsapi_configured = bool(settings.newsapi_key) or any(
        entry.provider == "newsapi" and entry.status != "skipped" for entry in entries
    )
    entries = entries[:limit]
    sources = [
        DataSourceSummary(
            id="gdelt",
            name="GDELT",
            configured=True,
            enabled=True,
            description="Public news discovery; article URLs are collected separately.",
        ),
        DataSourceSummary(
            id="newsapi",
            name="NewsAPI",
            configured=newsapi_configured,
            enabled=newsapi_configured,
            description="Supplementary news discovery alongside GDELT when configured.",
        ),
        DataSourceSummary(
            id="websites",
            name="Public websites",
            configured=True,
            enabled=True,
            description="Company pages, reports, careers and discovered news articles.",
        ),
        DataSourceSummary(
            id="eu_tenders",
            name="EU Funding & Tenders",
            configured=True,
            enabled=settings.eu_tenders_enabled,
            description=(
                "Open and forthcoming EU calls matching the service profile; "
                "a market-demand signal, not company evidence."
            ),
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
            newsapi_configured=newsapi_configured,
            eu_tenders_enabled=settings.eu_tenders_enabled,
            browser_rendering_enabled=settings.browser_rendering_enabled,
            source_text_retention_days=settings.source_text_retention_days,
            worker_concurrency=settings.worker_concurrency,
        ),
    )
