import os
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.contracts.research import PartialError, ResearchProgress
from app.jobs import service
from app.models.profile import ServiceProfile, ServiceProfileVersion, utc_now
from app.models.research import Company, ResearchRun


@pytest.fixture
def sessions() -> Generator[sessionmaker[Session], None, None]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to migrated disposable PostgreSQL database")
    engine = create_engine(url)
    yield sessionmaker(engine, expire_on_commit=False)
    engine.dispose()


def seed(sessions: sessionmaker[Session]) -> str:
    with sessions.begin() as session:
        company = Company(canonical_domain=f"{uuid4()}.example.com", display_name="Example")
        profile = ServiceProfile(name=str(uuid4()))
        profile.versions.append(ServiceProfileVersion(version=1, configuration={}))
        session.add_all([company, profile])
        session.flush()
        run = service.submit(session, company.id, profile.versions[0].id, str(uuid4()))
        return run.id


def test_concurrent_claim_and_fencing(sessions: sessionmaker[Session]) -> None:
    run_id = seed(sessions)
    barrier = Barrier(2)

    def take() -> tuple[str, str] | None:
        with sessions.begin() as session:
            barrier.wait(timeout=10)
            run = service.claim(session)
            if run is None:
                return None
            assert run.lease_token is not None
            return run.id, run.lease_token

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: take(), range(2)))
    claimed = [r for r in results if r is not None]
    assert len(claimed) == 1
    assert claimed[0][0] == run_id
    old_token = claimed[0][1]
    with sessions.begin() as session:
        service.heartbeat(session, run_id, old_token)
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.lease_expires_at = utc_now() - timedelta(seconds=1)
    with sessions.begin() as session:
        run = service.claim(session)
        assert run is not None and run.id == run_id and run.attempts == 2
        token = run.lease_token
        assert token is not None and token != old_token
    with sessions.begin() as session, pytest.raises(service.LeaseLost):
        service.finish(session, run_id, old_token)
    with sessions.begin() as session:
        service.checkpoint(
            session,
            run_id,
            token,
            ResearchProgress(stage="collection", completed=1, total=2),
            {"documents": ["one"]},
            [PartialError(stage="collection", code="timeout", message="Second source timed out")],
        )
        service.finish(session, run_id, token)
    with sessions() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None and run.status == "partial" and run.stage_results


def test_bounded_retry(sessions: sessionmaker[Session]) -> None:
    run_id = seed(sessions)
    for attempt in range(1, 4):
        with sessions.begin() as session:
            run = session.get(ResearchRun, run_id)
            assert run is not None
            run.available_at = utc_now() - timedelta(seconds=1)
            session.flush()
            claimed = service.claim(session)
            assert claimed is not None and claimed.id == run_id and claimed.attempts == attempt
            token = claimed.lease_token
            assert token is not None
        with sessions.begin() as session:
            service.fail(
                session,
                run_id,
                token,
                PartialError(stage="worker", code="timeout", message="Transient"),
                retryable=True,
            )
    with sessions.begin() as session:
        assert service.claim(session) is None
        run = session.get(ResearchRun, run_id)
        assert run is not None and run.status == "failed" and len(run.partial_errors) == 3
