from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts.common import ContractModel
from app.db import get_session
from app.discovery import (
    CatalogDiscovery,
    DiscoveryCandidate,
    DiscoveryRequest,
    WikidataDiscovery,
    WikidataError,
    store_candidates,
)
from app.jobs.imports import import_company
from app.models.profile import new_id, utc_now
from app.models.results import DiscoveryRun

router = APIRouter(prefix="/discovery-runs", tags=["discovery"])
RESEARCHABLE_DISCOVERY_STATUS = "researchable_v1"


class DiscoveryRunRead(ContractModel):
    id: str
    status: str
    request: DiscoveryRequest
    candidates: list[DiscoveryCandidate]
    confirmed_domains: list[str]
    created_at: datetime


class DiscoveryConfirmation(ContractModel):
    domains: list[str] = Field(min_length=1, max_length=10)


class DiscoveryConfirmationResult(ContractModel):
    run: DiscoveryRunRead
    company_ids: list[str]


def get_discovery_provider() -> WikidataDiscovery:
    return WikidataDiscovery(timeout=15)


def _read(run: DiscoveryRun) -> DiscoveryRunRead:
    created_at = run.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    return DiscoveryRunRead(
        id=run.id,
        status=run.status,
        request=DiscoveryRequest.model_validate(run.request),
        candidates=[DiscoveryCandidate.model_validate(item) for item in run.candidates],
        confirmed_domains=list(run.confirmed_domains),
        created_at=created_at,
    )


@router.post("", response_model=DiscoveryRunRead, status_code=201)
def create_discovery_run(
    payload: DiscoveryRequest,
    provider: Annotated[WikidataDiscovery, Depends(get_discovery_provider)],
    session: Session = Depends(get_session),
) -> DiscoveryRunRead:
    # Reuse matching recent results before external requests; retain the original
    # collection timestamp rather than presenting cached records as fresh research.
    recent = session.scalars(
        select(DiscoveryRun)
        .where(
            DiscoveryRun.status == RESEARCHABLE_DISCOVERY_STATUS,
            DiscoveryRun.created_at >= utc_now() - timedelta(minutes=15),
        )
        .order_by(DiscoveryRun.created_at.desc())
        .limit(100)
    ).all()
    cached = next((run for run in recent if run.request == payload.model_dump(mode="json")), None)
    if cached is not None:
        return _read(cached)
    local_candidates = CatalogDiscovery(session).discover(payload)
    if len(local_candidates) >= payload.limit:
        candidates = local_candidates
    else:
        candidates = None
    failure: WikidataError | None = None
    for _ in range(2 if candidates is None else 0):
        try:
            candidates = provider.discover(payload)
            store_candidates(session, candidates)
            break
        except WikidataError as exc:
            failure = exc
    if candidates is None:
        if local_candidates:
            candidates = local_candidates
        else:
            recent = session.scalars(
                select(DiscoveryRun)
                .where(DiscoveryRun.status == RESEARCHABLE_DISCOVERY_STATUS)
                .order_by(DiscoveryRun.created_at.desc())
                .limit(20)
            ).all()
            cached = next(
                (run for run in recent if run.request == payload.model_dump(mode="json")),
                None,
            )
            if cached is None:
                assert failure is not None
                raise HTTPException(status_code=502, detail=str(failure)) from failure
            return _read(cached)
    run = DiscoveryRun(
        id=new_id(),
        status=RESEARCHABLE_DISCOVERY_STATUS,
        request=payload.model_dump(mode="json"),
        candidates=[candidate.model_dump(mode="json") for candidate in candidates],
    )
    session.add(run)
    session.commit()
    return _read(run)


@router.get("/{run_id}", response_model=DiscoveryRunRead)
def get_discovery_run(run_id: str, session: Session = Depends(get_session)) -> DiscoveryRunRead:
    run = session.get(DiscoveryRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Discovery run not found")
    return _read(run)


@router.post("/{run_id}/confirm", response_model=DiscoveryConfirmationResult)
def confirm_discovery_run(
    run_id: str,
    payload: DiscoveryConfirmation,
    session: Session = Depends(get_session),
) -> DiscoveryConfirmationResult:
    run = session.get(DiscoveryRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Discovery run not found")
    available = {
        candidate["domain"]: candidate
        for candidate in run.candidates
        if isinstance(candidate.get("domain"), str)
    }
    requested = list(dict.fromkeys(domain.lower() for domain in payload.domains))
    if any(domain not in available for domain in requested):
        raise HTTPException(status_code=422, detail="Confirm only candidates from this run")

    company_ids: list[str] = []
    for domain in requested:
        company, _ = import_company(session, domain)
        candidate = available[domain]
        company.display_name = str(candidate["name"])
        company.facts = {
            **company.facts,
            "geography": {
                "value": candidate["country_name"],
                "source": candidate["source_url"],
            },
            "industry": {
                "value": candidate.get("industry"),
                "source": candidate["source_url"],
            },
            "company_size": {
                "value": candidate["employee_count"],
                "verification": candidate["size_verification"],
                "confidence": candidate["discovery_confidence"],
                "source": candidate["source_url"],
            },
        }
        company_ids.append(company.id)
    run.confirmed_domains = requested
    run.confirmed_at = utc_now()
    session.commit()
    return DiscoveryConfirmationResult(run=_read(run), company_ids=company_ids)
