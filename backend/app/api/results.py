import csv
import io
from typing import Literal, Protocol, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.api.result_contracts import (
    AssessmentRead,
    CompanyResultRead,
    EvidenceRead,
    OpportunityPage,
    OpportunityPatch,
    OpportunityRead,
    PageMeta,
    ResearchHistoryRead,
    ScoreRead,
    SourceRead,
    TranslationRead,
    TranslationRequest,
)
from app.assessment.providers.openrouter import OpenRouterError
from app.config import get_settings
from app.contracts.opportunity import OpportunityStatus
from app.contracts.score import Eligibility
from app.db import get_session
from app.models.profile import ServiceProfile, utc_now
from app.models.research import Company, ResearchRun
from app.models.results import (
    EvidenceTranslation,
    Opportunity,
    StoredEvidence,
    StoredScoreSnapshot,
    StoredSignalAssessment,
    StoredSourceDocument,
)
from app.translation.openrouter import OpenRouterTranslationProvider, TranslationBatch

router = APIRouter(tags=["results"])


class TranslationProvider(Protocol):
    model: str

    def translate(self, excerpt: str, target_language: str) -> TranslationBatch: ...


def get_translation_provider() -> TranslationProvider:
    settings = get_settings()
    if not settings.openrouter_api_key or not settings.assessment_model:
        raise HTTPException(status_code=503, detail="Translation provider is not configured")
    return OpenRouterTranslationProvider(
        api_key=settings.openrouter_api_key,
        model=settings.assessment_model,
        timeout=settings.assessment_timeout_seconds,
    )


def _collection_completion(run: ResearchRun | None) -> float:
    if run is None:
        return 0.0
    for item in run.progress:
        if item.get("stage") == "collection":
            completed, total = item.get("completed", 0), item.get("total", 0)
            if isinstance(completed, int) and isinstance(total, int) and total > 0:
                return min(1.0, completed / total)
    return 0.0


def _strongest(snapshot: StoredScoreSnapshot) -> str | None:
    positive = [
        item for item in snapshot.contributions if item.get("effect") == "positive"
    ]
    if not positive:
        return None
    def weight(item: dict[str, object]) -> float:
        value = item.get("weighted_value", 0)
        return float(value) if isinstance(value, int | float | str) else 0.0

    strongest = max(positive, key=weight)
    value = strongest.get("signal_id")
    return str(value) if value is not None else None


def _opportunity_read(
    opportunity: Opportunity,
    company: Company,
    profile: ServiceProfile,
    snapshot: StoredScoreSnapshot,
    run: ResearchRun | None,
) -> OpportunityRead:
    return OpportunityRead(
        id=opportunity.id,
        company_id=company.id,
        company_name=company.display_name,
        canonical_domain=company.canonical_domain,
        profile_id=profile.id,
        profile_name=profile.name,
        profile_version_id=snapshot.profile_version_id,
        status=opportunity.status,
        note=opportunity.note,
        score=snapshot.score,
        eligibility=snapshot.eligibility,
        coverage=snapshot.coverage,
        collection_completion=_collection_completion(run),
        strongest_signal=_strongest(snapshot),
        last_researched_at=snapshot.created_at,
    )


def _opportunity_statement(
    *,
    profile_id: str | None,
    status: OpportunityStatus | None,
    eligibility: Eligibility | None,
    search: str | None,
    min_score: float | None,
) -> Select[Opportunity, Company, ServiceProfile, StoredScoreSnapshot, ResearchRun]:
    statement = (
        select(Opportunity, Company, ServiceProfile, StoredScoreSnapshot, ResearchRun)
        .join(Company, Company.id == Opportunity.company_id)
        .join(ServiceProfile, ServiceProfile.id == Opportunity.profile_id)
        .join(StoredScoreSnapshot, StoredScoreSnapshot.id == Opportunity.latest_snapshot_id)
        .outerjoin(ResearchRun, ResearchRun.id == StoredScoreSnapshot.research_run_id)
    )
    if profile_id:
        statement = statement.where(Opportunity.profile_id == profile_id)
    if status:
        statement = statement.where(Opportunity.status == status)
    if eligibility:
        statement = statement.where(StoredScoreSnapshot.eligibility == eligibility)
    if min_score is not None:
        statement = statement.where(StoredScoreSnapshot.score >= min_score)
    if search:
        term = f"%{search.strip().casefold()}%"
        statement = statement.where(
            or_(
                func.lower(Company.display_name).like(term),
                func.lower(Company.canonical_domain).like(term),
            )
        )
    return statement


@router.get("/opportunities", response_model=OpportunityPage)
def list_opportunities(
    profile_id: str | None = None,
    status: OpportunityStatus | None = None,
    eligibility: Eligibility | None = None,
    search: str | None = Query(default=None, max_length=200),
    min_score: float | None = Query(default=None, ge=0, le=100),
    sort: Literal["score_desc", "score_asc", "updated_desc"] = "score_desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_session),
) -> OpportunityPage:
    statement = _opportunity_statement(
        profile_id=profile_id,
        status=status,
        eligibility=eligibility,
        search=search,
        min_score=min_score,
    )
    total = len(session.execute(statement).all())
    if sort == "score_asc":
        statement = statement.order_by(StoredScoreSnapshot.score.asc())
    elif sort == "updated_desc":
        statement = statement.order_by(Opportunity.updated_at.desc())
    else:
        statement = statement.order_by(StoredScoreSnapshot.score.desc())
    rows = cast(
        list[tuple[Opportunity, Company, ServiceProfile, StoredScoreSnapshot, ResearchRun | None]],
        session.execute(
            statement.order_by(Opportunity.updated_at.desc(), Opportunity.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all(),
    )
    return OpportunityPage(
        items=[_opportunity_read(*row) for row in rows],
        meta=PageMeta(page=page, page_size=page_size, total=total),
    )


@router.patch("/opportunities/{opportunity_id}", response_model=OpportunityRead)
def update_opportunity(
    opportunity_id: str,
    payload: OpportunityPatch,
    session: Session = Depends(get_session),
) -> OpportunityRead:
    opportunity = session.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    supplied = payload.model_fields_set
    if "status" in supplied:
        opportunity.status = cast(OpportunityStatus, payload.status).value
    if "note" in supplied:
        opportunity.note = payload.note
    opportunity.updated_at = utc_now()
    session.commit()
    row = cast(
        tuple[Opportunity, Company, ServiceProfile, StoredScoreSnapshot, ResearchRun | None],
        session.execute(
            _opportunity_statement(
                profile_id=None, status=None, eligibility=None, search=None, min_score=None
            ).where(Opportunity.id == opportunity_id)
        ).one(),
    )
    return _opportunity_read(*row)


@router.get("/companies/{company_id}", response_model=CompanyResultRead)
def company_detail(company_id: str, session: Session = Depends(get_session)) -> CompanyResultRead:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    scores = session.scalars(
        select(StoredScoreSnapshot)
        .where(StoredScoreSnapshot.company_id == company_id)
        .order_by(StoredScoreSnapshot.created_at.desc())
    ).all()
    latest_run_id = scores[0].research_run_id if scores else None
    assessments = session.scalars(
        select(StoredSignalAssessment)
        .where(
            StoredSignalAssessment.company_id == company_id,
            StoredSignalAssessment.research_run_id == latest_run_id,
        )
        .order_by(StoredSignalAssessment.created_at.desc())
    ).all()
    evidence_ids = {value for item in assessments for value in item.evidence_ids}
    evidence_rows = (
        session.scalars(select(StoredEvidence).where(StoredEvidence.id.in_(evidence_ids))).all()
        if evidence_ids
        else []
    )
    evidence_by_id = {item.id: item for item in evidence_rows}
    source_ids = {item.source_id for item in evidence_rows}
    sources = (
        session.scalars(
            select(StoredSourceDocument).where(StoredSourceDocument.id.in_(source_ids))
        ).all()
        if source_ids
        else []
    )
    source_by_id = {item.id: item for item in sources}
    translation_rows = (
        session.scalars(
            select(EvidenceTranslation).where(EvidenceTranslation.evidence_id.in_(evidence_ids))
        ).all()
        if evidence_ids
        else []
    )
    translations_by_evidence: dict[str, list[EvidenceTranslation]] = {}
    for translation in translation_rows:
        translations_by_evidence.setdefault(translation.evidence_id, []).append(translation)

    def evidence_read(item: StoredEvidence) -> EvidenceRead:
        source = source_by_id[item.source_id]
        return EvidenceRead(
            id=item.id,
            source_id=item.source_id,
            excerpt=item.excerpt,
            start_offset=item.start_offset,
            end_offset=item.end_offset,
            factual_claim=item.factual_claim,
            event_group_key=item.event_group_key,
            source=SourceRead.model_validate(source),
            translations=[
                TranslationRead.model_validate(value)
                for value in translations_by_evidence.get(item.id, [])
            ],
        )

    runs = session.scalars(
        select(ResearchRun)
        .where(ResearchRun.company_id == company_id)
        .order_by(ResearchRun.queued_at.desc())
    ).all()
    return CompanyResultRead(
        id=company.id,
        canonical_domain=company.canonical_domain,
        display_name=company.display_name,
        aliases=company.aliases,
        facts=company.facts,
        assessments=[
            AssessmentRead(
                id=item.id,
                profile_version_id=item.profile_version_id,
                signal_id=item.signal_id,
                status=item.status,
                evidence_strength=item.evidence_strength,
                rationale=item.rationale,
                evidence=[evidence_read(evidence_by_id[value]) for value in item.evidence_ids],
                model_version=item.model_version,
                prompt_version=item.prompt_version,
            )
            for item in assessments
        ],
        scores=[ScoreRead.model_validate(item) for item in scores],
        research_history=[ResearchHistoryRead.model_validate(item) for item in runs],
        created_at=company.created_at,
        updated_at=company.updated_at,
    )


@router.post("/evidence/{evidence_id}/translations", response_model=TranslationRead)
def translate_evidence(
    evidence_id: str,
    payload: TranslationRequest,
    session: Session = Depends(get_session),
    provider: TranslationProvider = Depends(get_translation_provider),
) -> EvidenceTranslation:
    evidence = session.get(StoredEvidence, evidence_id)
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    source = session.get(StoredSourceDocument, evidence.source_id)
    if source is None:
        raise HTTPException(status_code=409, detail="Evidence source is unavailable")
    cached = session.scalar(
        select(EvidenceTranslation).where(
            EvidenceTranslation.evidence_id == evidence.id,
            EvidenceTranslation.target_language == payload.target_language,
            EvidenceTranslation.provider_model == provider.model,
            EvidenceTranslation.source_text_hash == source.content_hash,
        )
    )
    if cached is not None:
        return cached
    try:
        result = provider.translate(evidence.excerpt, payload.target_language)
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail="Translation provider failed") from exc
    translation = EvidenceTranslation(
        evidence_id=evidence.id,
        target_language=payload.target_language,
        provider_model=result.model,
        source_text_hash=source.content_hash,
        translated_excerpt=result.translated_excerpt,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        total_tokens=result.total_tokens,
        cost_usd=result.cost_usd,
    )
    session.add(translation)
    session.commit()
    session.refresh(translation)
    return translation


def _csv_safe(value: object) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.startswith(("=", "+", "-", "@")) else text


@router.get("/exports/opportunities.csv")
def export_opportunities(
    profile_id: str | None = None,
    status: OpportunityStatus | None = None,
    eligibility: Eligibility | None = None,
    search: str | None = Query(default=None, max_length=200),
    min_score: float | None = Query(default=None, ge=0, le=100),
    session: Session = Depends(get_session),
) -> Response:
    rows = cast(
        list[tuple[Opportunity, Company, ServiceProfile, StoredScoreSnapshot, ResearchRun | None]],
        session.execute(
            _opportunity_statement(
                profile_id=profile_id,
                status=status,
                eligibility=eligibility,
                search=search,
                min_score=min_score,
            ).order_by(StoredScoreSnapshot.score.desc(), Opportunity.id)
        ).all(),
    )
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "company",
            "domain",
            "profile",
            "status",
            "eligibility",
            "score",
            "coverage",
            "strongest_signal",
        ]
    )
    for row in rows:
        item = _opportunity_read(*row)
        writer.writerow(
            [
                _csv_safe(item.company_name),
                _csv_safe(item.canonical_domain),
                _csv_safe(item.profile_name),
                item.status,
                item.eligibility,
                item.score,
                item.coverage,
                _csv_safe(item.strongest_signal),
            ]
        )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="opportunities.csv"'},
    )
