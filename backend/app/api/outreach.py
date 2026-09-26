from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.assessment.providers.openrouter import OpenRouterError
from app.config import get_settings
from app.contracts.common import ContractModel
from app.db import get_session
from app.models.profile import ServiceProfileVersion
from app.models.research import Company, ResearchRun
from app.models.results import StoredEvidence, StoredSignalAssessment, StoredSourceDocument
from app.outreach import (
    CURATED_EMAIL_DOMAINS,
    DraftRequest,
    OutreachDraftBundle,
    OutreachEvidence,
    generate_fallback,
)
from app.outreach.contacts import find_contacts
from app.outreach.openrouter import OpenRouterOutreachProvider

router = APIRouter(tags=["outreach"])


class ContactRead(ContractModel):
    email: str
    name: str | None
    role: str | None
    source_url: str
    source_title: str
    confidence: float


@router.get("/companies/{company_id}/outreach-contact", response_model=ContactRead | None)
def discover_outreach_contact(
    company_id: str, session: Session = Depends(get_session)
) -> ContactRead | None:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    documents = list(
        session.scalars(
            select(StoredSourceDocument)
            .where(
                StoredSourceDocument.company_id == company_id,
                StoredSourceDocument.normalized_text.is_not(None),
            )
            .order_by(StoredSourceDocument.retrieved_at.desc())
        ).all()
    )
    contacts = find_contacts(documents, company.canonical_domain)
    return ContactRead(**contacts[0].__dict__) if contacts else None


@router.post("/companies/{company_id}/outreach-drafts", response_model=OutreachDraftBundle)
def generate_outreach_drafts(
    company_id: str,
    payload: DraftRequest,
    session: Session = Depends(get_session),
) -> OutreachDraftBundle:
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    run = session.scalar(
        select(ResearchRun)
        .where(ResearchRun.company_id == company_id)
        .order_by(ResearchRun.queued_at.desc())
    )
    if run is None:
        raise HTTPException(status_code=409, detail="Research is required before drafting outreach")
    assessments = session.scalars(
        select(StoredSignalAssessment).where(
            StoredSignalAssessment.research_run_id == run.id,
            StoredSignalAssessment.status == "supported",
        )
    ).all()
    signal_by_evidence = {
        evidence_id: assessment.signal_id
        for assessment in assessments
        for evidence_id in assessment.evidence_ids
    }
    evidence_rows = session.scalars(
        select(StoredEvidence).where(StoredEvidence.id.in_(signal_by_evidence))
    ).all()
    sources = {
        source.id: source
        for source in session.scalars(
            select(StoredSourceDocument).where(
                StoredSourceDocument.id.in_({item.source_id for item in evidence_rows})
            )
        ).all()
    }
    evidence = [
        OutreachEvidence(
            id=item.id,
            signal_id=signal_by_evidence[item.id],
            factual_claim=item.factual_claim,
            excerpt=item.excerpt,
            source_title=sources[item.source_id].title,
            source_url=sources[item.source_id].canonical_url,
        )
        for item in evidence_rows
        if item.source_id in sources
    ]
    if not evidence:
        raise HTTPException(
            status_code=422, detail="No supported evidence is available for outreach"
        )
    profile = session.get(ServiceProfileVersion, run.profile_version_id)
    service_description = (
        str(profile.configuration.get("service_description") or "") if profile else ""
    )
    bundle = generate_fallback(
        company_id=company.id,
        company_name=company.display_name,
        company_domain=company.canonical_domain,
        service_description=service_description,
        request=payload,
        evidence=evidence,
    )
    settings = get_settings()
    if (
        company.canonical_domain.casefold() not in CURATED_EMAIL_DOMAINS
        and settings.openrouter_api_key
        and settings.assessment_model
    ):
        try:
            drafts = OpenRouterOutreachProvider(
                api_key=settings.openrouter_api_key,
                model=settings.assessment_model,
                timeout=settings.assessment_timeout_seconds,
            ).generate(
                company_name=company.display_name,
                service_description=service_description,
                request=payload,
                evidence=evidence,
            )
            return bundle.model_copy(update={"drafts": drafts})
        except OpenRouterError:
            pass
    return bundle
