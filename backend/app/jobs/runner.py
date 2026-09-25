"""Worker orchestration; adapters own collection and assessment implementations."""

import logging
from dataclasses import dataclass, field
from threading import Event, Thread
from typing import Protocol

from sqlalchemy.orm import Session, sessionmaker

from app.contracts.research import PartialError, ResearchProgress
from app.jobs import service
from app.models.profile import ServiceProfileVersion
from app.models.research import Company, ResearchRun

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StageResult:
    data: object
    completed: int
    total: int
    errors: list[PartialError] = field(default_factory=list)
    links: dict[str, str] = field(default_factory=dict)


class ResearchPipeline(Protocol):
    def collect(self, company: Company) -> StageResult: ...

    def assess(
        self, company: Company, profile: dict[str, object], sources: object
    ) -> StageResult: ...


class RetryableResearchError(Exception):
    """Adapters may request one of the two bounded retries for transient failures."""


class UnconfiguredPipeline:
    def collect(self, company: Company) -> StageResult:
        raise RuntimeError("Collection and assessment adapters are not configured")

    def assess(self, company: Company, profile: dict[str, object], sources: object) -> StageResult:
        raise RuntimeError("Assessment adapter is not configured")


def run_once(sessions: sessionmaker[Session], pipeline: ResearchPipeline) -> bool:
    with sessions.begin() as session:
        run = service.claim(session)
        if run is None:
            return False
        run_id, token = run.id, run.lease_token
    assert token is not None
    stop = Event()

    def keep_alive() -> None:
        while not stop.wait(15):
            try:
                with sessions.begin() as session:
                    service.heartbeat(session, run_id, token)
            except Exception:
                logger.exception("Research heartbeat failed for %s", run_id)
                return

    thread = Thread(target=keep_alive, daemon=True)
    thread.start()
    try:
        with sessions() as session:
            current = session.get(ResearchRun, run_id)
            assert current is not None
            company = session.get(Company, current.company_id)
            profile = session.get(ServiceProfileVersion, current.profile_version_id)
            assert company is not None and profile is not None
            saved = dict(current.stage_results)
            configuration = dict(profile.configuration)
            session.expunge(company)
        for stage in ("collection", "assessment"):
            if stage in saved:
                continue
            result = (
                pipeline.collect(company)
                if stage == "collection"
                else pipeline.assess(company, configuration, saved["collection"])
            )
            with sessions.begin() as session:
                service.checkpoint(
                    session,
                    run_id,
                    token,
                    ResearchProgress(stage=stage, completed=result.completed, total=result.total),
                    result.data,
                    result.errors,
                    result.links,
                )
            saved[stage] = result.data
        with sessions.begin() as session:
            service.finish(session, run_id, token)
    except service.LeaseLost:
        logger.warning("Research lease lost for %s", run_id)
    except Exception as exc:
        logger.exception("Research attempt failed for %s", run_id)
        try:
            with sessions.begin() as session:
                service.fail(
                    session,
                    run_id,
                    token,
                    PartialError(
                        stage="worker",
                        code=type(exc).__name__,
                        message="Research stage failed; inspect worker logs for details",
                    ),
                    retryable=isinstance(exc, RetryableResearchError),
                )
        except service.LeaseLost:
            logger.warning("Cannot record failure after lease loss for %s", run_id)
    finally:
        stop.set()
        thread.join(timeout=1)
    return True
