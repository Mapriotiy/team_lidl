from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(tags=["research"])


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
