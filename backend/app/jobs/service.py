"""Transaction-scoped submission and PostgreSQL lease-fenced job operations."""

from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.contracts.research import PartialError, ResearchProgress
from app.models.profile import utc_now
from app.models.research import ResearchRun


class IdempotencyConflict(ValueError):
    pass


class LeaseLost(RuntimeError):
    pass


def submit(
    session: Session, company_id: str, profile_version_id: str, idempotency_key: str
) -> ResearchRun:
    run = session.scalar(select(ResearchRun).where(ResearchRun.idempotency_key == idempotency_key))
    if run is None:
        run = ResearchRun(
            company_id=company_id,
            profile_version_id=profile_version_id,
            idempotency_key=idempotency_key,
            operation="research",
        )
        try:
            with session.begin_nested():
                session.add(run)
                session.flush()
        except IntegrityError:
            run = session.scalar(
                select(ResearchRun).where(ResearchRun.idempotency_key == idempotency_key)
            )
            if run is None:
                raise
    if (run.company_id, run.profile_version_id, run.operation) != (
        company_id,
        profile_version_id,
        "research",
    ):
        raise IdempotencyConflict("Idempotency key was already used for different research inputs")
    return run


def claim(
    session: Session, *, now: datetime | None = None, lease_seconds: int = 60
) -> ResearchRun | None:
    """Caller commits promptly; row lock + SKIP LOCKED excludes competing workers."""
    if session.get_bind().dialect.name != "postgresql":
        raise RuntimeError("Atomic research claiming requires PostgreSQL")
    if lease_seconds < 1:
        raise ValueError("Lease duration must be positive")
    now = now or utc_now()
    # A crashed final attempt must become terminal instead of remaining running forever.
    exhausted = session.scalars(
        select(ResearchRun)
        .where(
            ResearchRun.status == "running",
            ResearchRun.lease_expires_at <= now,
            ResearchRun.attempts >= ResearchRun.max_attempts,
        )
        .with_for_update(skip_locked=True)
        .limit(100)
    )
    for stale in exhausted:
        stale.status = "partial" if stale.stage_results else "failed"
        stale.finished_at = now
        stale.lease_token = None
        stale.lease_expires_at = None
        stale.partial_errors = [
            *stale.partial_errors,
            {
                "stage": "worker",
                "code": "lease_exhausted",
                "message": "Final worker lease expired",
            },
        ]
    run = session.scalar(
        select(ResearchRun)
        .where(
            ResearchRun.attempts < ResearchRun.max_attempts,
            or_(
                and_(ResearchRun.status == "queued", ResearchRun.available_at <= now),
                and_(ResearchRun.status == "running", ResearchRun.lease_expires_at <= now),
            ),
        )
        .order_by(ResearchRun.available_at, ResearchRun.queued_at, ResearchRun.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if run is None:
        return None
    run.status = "running"
    run.attempts += 1
    run.lease_token = str(uuid4())
    run.heartbeat_at = now
    run.lease_expires_at = now + timedelta(seconds=lease_seconds)
    run.started_at = run.started_at or now
    session.flush()
    return run


def owned(session: Session, run_id: str, token: str, now: datetime | None = None) -> ResearchRun:
    run = session.scalar(
        select(ResearchRun)
        .where(
            ResearchRun.id == run_id,
            ResearchRun.status == "running",
            ResearchRun.lease_token == token,
            ResearchRun.lease_expires_at > (now or utc_now()),
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if run is None:
        raise LeaseLost("Research lease expired or belongs to another worker")
    return run


def heartbeat(session: Session, run_id: str, token: str, *, lease_seconds: int = 60) -> None:
    if lease_seconds < 1:
        raise ValueError("Lease duration must be positive")
    now = utc_now()
    run = owned(session, run_id, token, now)
    run.heartbeat_at = now
    run.lease_expires_at = now + timedelta(seconds=lease_seconds)


def checkpoint(
    session: Session,
    run_id: str,
    token: str,
    progress: ResearchProgress,
    result: object,
    errors: list[PartialError],
    links: dict[str, str] | None = None,
) -> None:
    if progress.completed > progress.total:
        raise ValueError("Completed count cannot exceed stage total")
    run = owned(session, run_id, token)
    run.progress = [p for p in run.progress if p["stage"] != progress.stage] + [
        progress.model_dump(mode="json")
    ]
    run.stage_results = {**run.stage_results, progress.stage: result}
    run.partial_errors = [p for p in run.partial_errors if p["stage"] != progress.stage] + [
        error.model_dump(mode="json") for error in errors
    ]
    run.result_links = {**run.result_links, **(links or {})}


def finish(session: Session, run_id: str, token: str) -> None:
    run = owned(session, run_id, token)
    run.status = "partial" if run.partial_errors else "completed"
    run.finished_at = utc_now()
    run.lease_token = None
    run.lease_expires_at = None


def fail(
    session: Session, run_id: str, token: str, error: PartialError, *, retryable: bool
) -> None:
    run = owned(session, run_id, token)
    run.partial_errors = [*run.partial_errors, error.model_dump(mode="json")]
    now = utc_now()
    if retryable and run.attempts < run.max_attempts:
        run.status = "queued"
        run.available_at = now + timedelta(seconds=5 * 2 ** (run.attempts - 1))
    else:
        run.status = "partial" if run.stage_results else "failed"
        run.finished_at = now
    run.lease_token = None
    run.lease_expires_at = None
