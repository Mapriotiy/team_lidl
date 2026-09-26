"""Optional market signal from EU calls for tenders; disabled unless EU_TENDERS_ENABLED."""

import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings, get_settings
from app.contracts.profile import ProfileConfiguration
from app.db import get_session
from app.discovery import EuTendersDiscovery, EuTendersError, TenderCall
from app.models.profile import ServiceProfile

router = APIRouter(prefix="/eu-tenders", tags=["eu-tenders"])

_STOPWORDS = {
    "about", "company", "does", "from", "have", "into", "that", "their", "there",
    "this", "what", "when", "where", "which", "with", "would", "services", "service",
    "current", "dated", "evidence", "initiative", "named", "program", "public", "relevant",
}  # fmt: skip
MAX_TERMS = 5
_DOMAIN_PHRASES = (
    "robotic process automation",
    "intelligent automation",
    "process automation",
    "workflow modernization",
    "process improvement",
    "process mining",
    "digital transformation",
    "artificial intelligence",
    "cybersecurity",
    "cloud migration",
    "platform modernization",
    "software development",
    "product engineering",
)


class EuTendersStatus(BaseModel):
    id: Literal["eu_tenders"] = "eu_tenders"
    name: str = "EU Funding & Tenders"
    enabled: bool
    description: str = (
        "Open and forthcoming EU calls for tenders matching the service profile; "
        "a market-demand signal, not company evidence."
    )


class EuTendersSearch(BaseModel):
    profile_id: str
    profile_name: str
    query: str
    total: int
    calls: list[TenderCall]
    retrieved_at: datetime
    warnings: list[str] = Field(default_factory=list)


def profile_query(configuration: ProfileConfiguration) -> str:
    text = " ".join(
        [configuration.service_role or "", configuration.service_description]
        + [signal.question for signal in configuration.signals]
        + [criterion for signal in configuration.signals for criterion in signal.positive_criteria]
    )
    lowered = text.casefold()
    acronyms = re.findall(r"\b[A-Z][A-Z0-9]{1,9}\b", text)
    if "RPA" in acronyms:
        # SEDIA expands phrases very loosely; the central domain term produces a
        # smaller candidate pool that can be validated deterministically downstream.
        return "automation"
    phrases = [phrase for phrase in _DOMAIN_PHRASES if phrase in lowered]
    if phrases:
        return phrases[0]
    terms: list[str] = []
    for term in re.findall(r"[A-Za-z][A-Za-z0-9-]{3,}", lowered):
        if term not in _STOPWORDS and term not in terms:
            terms.append(term)
        if len(terms) == MAX_TERMS:
            break
    return " ".join(terms[:3]) or "digital transformation"


def get_tenders(settings: Settings = Depends(get_settings)) -> EuTendersDiscovery:
    if not settings.eu_tenders_enabled:
        raise HTTPException(status_code=404, detail="EU tenders source is disabled")
    return EuTendersDiscovery()


@router.get("/status", response_model=EuTendersStatus)
def get_status(settings: Settings = Depends(get_settings)) -> EuTendersStatus:
    return EuTendersStatus(enabled=settings.eu_tenders_enabled)


@router.get("/search", response_model=EuTendersSearch)
def search(
    profile_id: str = Query(min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
    include_forthcoming: bool = True,
    session: Session = Depends(get_session),
    tenders: EuTendersDiscovery = Depends(get_tenders),
) -> EuTendersSearch:
    profile = session.scalar(
        select(ServiceProfile)
        .where(ServiceProfile.id == profile_id)
        .options(selectinload(ServiceProfile.versions))
    )
    if profile is None or not profile.versions:
        raise HTTPException(status_code=404, detail="Service profile not found")
    configuration = ProfileConfiguration.model_validate(profile.versions[-1].configuration)
    query = profile_query(configuration)
    try:
        result = tenders.search(query, limit=limit, include_forthcoming=include_forthcoming)
    except EuTendersError as exc:
        # Keep upstream text out of the response; the portal message is not user-facing.
        detail = "EU tenders portal is temporarily unavailable" if exc.retryable else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc
    return EuTendersSearch(
        profile_id=profile.id,
        profile_name=profile.name,
        query=result.query,
        total=result.total,
        calls=result.calls,
        retrieved_at=result.retrieved_at,
        warnings=(
            ["Calls are published by EU bodies and never name prospects; treat as market demand."]
        ),
    )
