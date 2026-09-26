from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.api.research_contracts import (
    AcceptedCompany,
    CompanyImport,
    CompanyImportResult,
    RejectedCompany,
    ResearchSubmission,
)
from app.contracts.common import ErrorDetail
from app.contracts.company import CompanySummary
from app.contracts.research import ResearchRunRead
from app.db import get_session
from app.jobs.imports import import_company
from app.jobs.service import IdempotencyConflict, submit
from app.models.profile import ServiceProfileVersion, utc_now
from app.models.research import Company, ResearchRun
from app.models.results import (
    EvidenceTranslation,
    Opportunity,
    StoredEvidence,
    StoredScoreSnapshot,
    StoredSignalAssessment,
    StoredSourceDocument,
)

router = APIRouter(tags=["research"])


@router.get("/companies", response_model=list[CompanySummary])
def list_companies(session: Session = Depends(get_session)) -> list[CompanySummary]:
    companies = session.scalars(select(Company).order_by(Company.display_name, Company.id)).all()
    return [CompanySummary.model_validate(company) for company in companies]


def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status,
        detail=ErrorDetail(
            code=code, message=message, request_id=str(uuid4()), occurred_at=utc_now()
        ).model_dump(mode="json"),
    )


@router.post("/companies/import", response_model=CompanyImportResult)
def import_companies(
    payload: CompanyImport, session: Session = Depends(get_session)
) -> CompanyImportResult:
    accepted: list[AcceptedCompany] = []
    rejected: list[RejectedCompany] = []
    for entry in payload.domains:
        try:
            company, created = import_company(session, entry)
        except (ValueError, UnicodeError):
            rejected.append(
                RejectedCompany(
                    input=entry,
                    code="invalid_domain",
                    message="Provide a valid public company domain or credential-free HTTP(S) URL",
                )
            )
            continue
        accepted.append(
            AcceptedCompany(
                input=entry, company=CompanySummary.model_validate(company), created=created
            )
        )
    session.commit()
    return CompanyImportResult(accepted=accepted, rejected=rejected)


@router.post("/research-runs", response_model=ResearchRunRead, status_code=202)
def create_run(
    payload: ResearchSubmission, session: Session = Depends(get_session)
) -> ResearchRunRead:
    if session.get(Company, payload.company_id) is None:
        raise api_error(404, "company_not_found", "Company not found")
    if session.get(ServiceProfileVersion, payload.profile_version_id) is None:
        raise api_error(404, "profile_version_not_found", "Service profile version not found")
    try:
        run = submit(
            session, payload.company_id, payload.profile_version_id, payload.idempotency_key
        )
    except IdempotencyConflict as exc:
        raise api_error(409, "idempotency_conflict", str(exc)) from exc
    session.commit()
    return ResearchRunRead.model_validate(run)


@router.get("/research-runs/{run_id}", response_model=ResearchRunRead)
def get_run(run_id: str, session: Session = Depends(get_session)) -> ResearchRunRead:
    run = session.get(ResearchRun, run_id)
    if run is None:
        raise api_error(404, "research_run_not_found", "Research run not found")
    return ResearchRunRead.model_validate(run)


@router.delete("/companies/{company_id}/research")
def delete_company_research(
    company_id: str, session: Session = Depends(get_session)
) -> dict[str, int]:
    if session.get(Company, company_id) is None:
        raise api_error(404, "company_not_found", "Company not found")
    run_ids = select(ResearchRun.id).where(ResearchRun.company_id == company_id)
    source_ids = select(StoredSourceDocument.id).where(
        StoredSourceDocument.research_run_id.in_(run_ids)
    )
    evidence_ids = select(StoredEvidence.id).where(StoredEvidence.source_id.in_(source_ids))
    snapshot_ids = select(StoredScoreSnapshot.id).where(
        StoredScoreSnapshot.research_run_id.in_(run_ids)
    )
    session.execute(
        update(Opportunity)
        .where(Opportunity.latest_snapshot_id.in_(snapshot_ids))
        .values(latest_snapshot_id=None)
    )
    session.execute(
        delete(EvidenceTranslation).where(EvidenceTranslation.evidence_id.in_(evidence_ids))
    )
    session.execute(delete(StoredEvidence).where(StoredEvidence.id.in_(evidence_ids)))
    session.execute(delete(StoredSourceDocument).where(StoredSourceDocument.id.in_(source_ids)))
    session.execute(
        delete(StoredSignalAssessment).where(StoredSignalAssessment.research_run_id.in_(run_ids))
    )
    session.execute(delete(StoredScoreSnapshot).where(StoredScoreSnapshot.id.in_(snapshot_ids)))
    removed_ids = session.scalars(
        delete(ResearchRun).where(ResearchRun.company_id == company_id).returning(ResearchRun.id)
    ).all()
    session.commit()
    return {"deleted_runs": len(removed_ids)}
