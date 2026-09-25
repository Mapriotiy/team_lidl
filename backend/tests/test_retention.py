from datetime import UTC, datetime, timedelta

from test_profiles_api import TestingSession, setup_function, teardown_function  # noqa: F401
from test_results_api import seed_result

from app.collection.retention import purge_expired_source_text
from app.models.results import StoredEvidence, StoredSourceDocument


def test_expired_text_is_cleared_without_removing_metadata_or_evidence() -> None:
    seed_result()
    now = datetime.now(UTC)
    with TestingSession.begin() as session:
        source = session.get(StoredSourceDocument, "source-1")
        assert source is not None
        source.text_expires_at = now - timedelta(seconds=1)

    with TestingSession() as session:
        assert purge_expired_source_text(session, now=now) == 1
        assert purge_expired_source_text(session, now=now) == 0

    with TestingSession() as session:
        source = session.get(StoredSourceDocument, "source-1")
        assert source is not None
        assert source.normalized_text is None
        assert source.canonical_url == "https://example.com/news"
        assert session.query(StoredEvidence).one().excerpt == "efficiency program"


def test_unexpired_text_is_preserved() -> None:
    seed_result()
    with TestingSession() as session:
        assert purge_expired_source_text(session, now=datetime.now(UTC)) == 0
        source = session.get(StoredSourceDocument, "source-1")
        assert source is not None and source.normalized_text is not None
