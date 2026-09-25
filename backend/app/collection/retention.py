"""Retention cleanup removes expired full text while preserving derived research records."""

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.results import StoredSourceDocument


def purge_expired_source_text(session: Session, *, now: datetime | None = None) -> int:
    cutoff = now or datetime.now(UTC)
    expired_ids = session.scalars(
        select(StoredSourceDocument.id).where(
            StoredSourceDocument.text_expires_at <= cutoff,
            StoredSourceDocument.normalized_text.is_not(None),
        )
    ).all()
    if not expired_ids:
        return 0
    session.execute(
        update(StoredSourceDocument)
        .where(StoredSourceDocument.id.in_(expired_ids))
        .values(normalized_text=None)
    )
    session.commit()
    return len(expired_ids)


def main() -> None:
    with SessionLocal() as session:
        count = purge_expired_source_text(session)
    print(f"Cleared expired source text from {count} document(s).")


if __name__ == "__main__":
    main()
