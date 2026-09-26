"""Optional market signal from EU calls for tenders; disabled unless EU_TENDERS_ENABLED."""

import re
from datetime import UTC, datetime
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


class TenderFitDimension(BaseModel):
    id: str
    label: str
    score: int | None = Field(default=None, ge=0, le=100)
    explanation: str


class TenderOpportunity(BaseModel):
    call: TenderCall
    fit_score: int = Field(ge=0, le=100)
    recommendation: Literal["bid", "partner", "monitor", "reject", "needs_review"]
    dimensions: list[TenderFitDimension]
    matched_terms: list[str]
    risks: list[str]


class EuTendersSearch(BaseModel):
    profile_id: str
    profile_name: str
    query: str
    total: int
    calls: list[TenderCall]
    opportunities: list[TenderOpportunity] = Field(default_factory=list)
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
    if "cybersecurity" in lowered or "security engineering" in lowered:
        return "cybersecurity"
    if "software development" in lowered or "product engineering" in lowered:
        return "software"
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


# SEDIA ranks single words well and phrases poorly, so each domain fans out into a few
# synonym queries; the relevance stems then drop cascade calls that merely matched a word.
_EXPANSIONS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "automation": (
        ("automation", "digitalisation", "robotic", "process", "IT services"),
        (
            "automat",
            "robot",
            "digitali",
            "digital",
            "workflow",
            "artificial intelligence",
            "software",
        ),
    ),
    "cybersecurity": (
        ("cybersecurity", "cyber", "security", "information security", "ICT"),
        ("cyber", "security", "resilien", "threat", "incident"),
    ),
    "software": (
        ("software", "IT services", "application development", "digital", "ICT"),
        (
            "software",
            "digital",
            "platform",
            "application",
            "data",
            "cloud",
            "artificial intelligence",
        ),
    ),
}


def profile_queries(configuration: ProfileConfiguration) -> tuple[list[str], list[str] | None]:
    primary = profile_query(configuration)
    expansion = _EXPANSIONS.get(primary)
    if expansion is None:
        return [primary], None
    queries, stems = expansion
    return list(queries), list(stems)


def get_tenders(settings: Settings = Depends(get_settings)) -> EuTendersDiscovery:
    if not settings.eu_tenders_enabled:
        raise HTTPException(status_code=404, detail="EU tenders source is disabled")
    return EuTendersDiscovery()


def _fit_opportunity(call: TenderCall, query: str, *, now: datetime) -> TenderOpportunity:
    terms = list(dict.fromkeys(re.findall(r"[a-z0-9-]{3,}", query.casefold())))
    text = f"{call.title} {call.summary}".casefold()
    matched = [term for term in terms if term in text]
    capability = round(100 * len(matched) / len(terms)) if terms else 0
    evidence = 35 + (20 if call.deadline else 0) + (20 if call.summary else 0)
    evidence += 15 if call.programme else 0
    evidence += 10 if call.budget is not None else 0
    evidence = min(100, evidence)
    if call.deadline is None:
        deadline_score = None
        deadline_note = "No structured deadline was supplied by the portal."
    else:
        remaining = max(0, (call.deadline - now).days)
        deadline_score = 90 if remaining >= 30 else 65 if remaining >= 14 else 30
        deadline_note = f"{remaining} days remain before the published deadline."
    type_score = 100 if call.opportunity_type == "public_procurement" else 65
    fit_score = round(
        0.5 * capability
        + 0.25 * evidence
        + 0.15 * (deadline_score if deadline_score is not None else 45)
        + 0.1 * type_score
    )
    risks = ["Eligibility requirements have not yet been extracted from the call documents."]
    if call.budget is None:
        risks.append("No structured budget is available from the search result.")
    if call.opportunity_type != "public_procurement":
        risks.append("This is funding demand, not a procurement contract.")
    if capability < 50:
        recommendation = "reject"
    elif call.opportunity_type == "public_procurement" and evidence >= 85 and fit_score >= 80:
        recommendation = "bid"
    elif call.opportunity_type in {"funding_call", "cascade_funding"} and fit_score >= 65:
        recommendation = "partner"
    elif deadline_score is not None and deadline_score < 50:
        recommendation = "monitor"
    else:
        recommendation = "needs_review"
    return TenderOpportunity(
        call=call,
        fit_score=fit_score,
        recommendation=recommendation,
        matched_terms=matched,
        risks=risks,
        dimensions=[
            TenderFitDimension(
                id="capability",
                label="Capability fit",
                score=capability,
                explanation=(
                    f"Matched profile terms: {', '.join(matched)}."
                    if matched
                    else "No profile term is present in the returned title or summary."
                ),
            ),
            TenderFitDimension(
                id="evidence",
                label="Evidence completeness",
                score=evidence,
                explanation="Based on available summary, deadline, programme and budget fields.",
            ),
            TenderFitDimension(
                id="deadline",
                label="Deadline readiness",
                score=deadline_score,
                explanation=deadline_note,
            ),
            TenderFitDimension(
                id="eligibility",
                label="Eligibility fit",
                score=None,
                explanation="Needs document-level extraction before a bid decision.",
            ),
        ],
    )


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
    queries, stems = profile_queries(configuration)
    try:
        result = tenders.search_many(
            queries,
            relevance_terms=stems,
            limit=limit,
            include_forthcoming=include_forthcoming,
        )
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
        opportunities=[
            _fit_opportunity(call, result.query, now=datetime.now(UTC)) for call in result.calls
        ],
        retrieved_at=result.retrieved_at,
        warnings=(
            ["Calls are published by EU bodies and never name prospects; treat as market demand."]
        ),
    )
