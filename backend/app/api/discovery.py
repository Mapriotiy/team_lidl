from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from app.contracts.common import ContractModel
from app.db import get_session
from app.discovery import DiscoveryCandidate, DiscoveryRequest, WikidataDiscovery, WikidataError
from app.jobs.imports import import_company
from app.models.profile import new_id, utc_now
from app.models.results import DiscoveryRun

router = APIRouter(prefix="/discovery-runs", tags=["discovery"])


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
    return WikidataDiscovery()


def _read(run: DiscoveryRun) -> DiscoveryRunRead:
    return DiscoveryRunRead(
        id=run.id,
        status=run.status,
        request=DiscoveryRequest.model_validate(run.request),
        candidates=[DiscoveryCandidate.model_validate(item) for item in run.candidates],
        confirmed_domains=list(run.confirmed_domains),
        created_at=run.created_at,
    )


@router.post("", response_model=DiscoveryRunRead, status_code=201)
def create_discovery_run(
    payload: DiscoveryRequest,
    provider: Annotated[WikidataDiscovery, Depends(get_discovery_provider)],
    session: Session = Depends(get_session),
) -> DiscoveryRunRead:
    try:
        candidates = provider.discover(payload)
    except WikidataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    run = DiscoveryRun(
        id=new_id(),
        status="completed",
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
