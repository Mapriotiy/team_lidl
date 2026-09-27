"""Profile-based access to Moldova's official MTender search."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.eu_tenders import EuTendersSearch, _fit_opportunity, profile_query
from app.config import Settings, get_settings
from app.contracts.profile import ProfileConfiguration
from app.db import get_session
from app.discovery import EuTendersError, MoldovaTendersDiscovery
from app.models.profile import ServiceProfile

router = APIRouter(prefix="/moldova-tenders", tags=["moldova-tenders"])

_LOCAL_QUERIES = {
    "automation": ["automatizare", "RPA", "automatizarea proceselor", "robotizare"],
    "cybersecurity": [
        "securitate cibernetică",
        "securitate informațională",
        "protecția datelor",
    ],
    "software development": [
        "software",
        "sistem informatic",
        "dezvoltare software",
        "mentenanță software",
    ],
}
_LOCAL_RELEVANCE = {
    "automation": ["automatiz", "robot", "rpa", "workflow", "digitaliz"],
    "cybersecurity": ["cibernetic", "securitate", "antivirus", "firewall", "csoc"],
    "software development": ["software", "soft-uri", "informatic", "aplicativ", "licenț", "server"],
}


def get_moldova_tenders(settings: Settings = Depends(get_settings)) -> MoldovaTendersDiscovery:
    if not settings.moldova_tenders_enabled:
        raise HTTPException(status_code=404, detail="Moldova tenders source is disabled")
    return MoldovaTendersDiscovery()


@router.get("/search", response_model=EuTendersSearch)
def search(
    profile_id: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
    tenders: MoldovaTendersDiscovery = Depends(get_moldova_tenders),
) -> EuTendersSearch:
    profile = session.scalar(
        select(ServiceProfile)
        .where(ServiceProfile.id == profile_id)
        .options(selectinload(ServiceProfile.versions))
    )
    if profile is None or not profile.versions:
        raise HTTPException(status_code=404, detail="Service profile not found")
    configuration = ProfileConfiguration.model_validate(profile.versions[-1].configuration)
    primary = profile_query(configuration)
    queries = _LOCAL_QUERIES.get(primary, [primary])
    try:
        relevance_terms = _LOCAL_RELEVANCE.get(primary)
        result = tenders.search_many(queries, relevance_terms=relevance_terms, limit=limit)
    except EuTendersError as exc:
        raise HTTPException(
            status_code=502, detail="Moldova MTender is temporarily unavailable"
        ) from exc
    now = datetime.now(UTC)
    opportunities = []
    for call in result.calls:
        text = f"{call.title} {call.summary}".casefold()
        matched_terms = [term for term in (relevance_terms or []) if term in text]
        matched_query = " ".join(matched_terms) or primary
        opportunities.append(_fit_opportunity(call, matched_query, now=now))
    opportunities.sort(key=lambda item: -item.fit_score)
    return EuTendersSearch(
        profile_id=profile.id,
        profile_name=profile.name,
        query=result.query,
        queries=queries,
        total=result.total,
        calls=[item.call for item in opportunities],
        opportunities=opportunities,
        retrieved_at=result.retrieved_at,
        warnings=["MTender records are official public procurement data from Moldova."],
    )
