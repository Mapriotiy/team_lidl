from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.discovery import CatalogDiscovery, DiscoveryCandidate, DiscoveryRequest, SizeVerification
from app.discovery.catalog import store_candidates


def candidate(
    entity_id: str, domain: str, *, industry: str | None, employees: int | None
) -> DiscoveryCandidate:
    return DiscoveryCandidate(
        entity_id=entity_id,
        name=domain.split(".")[0].title(),
        domain=domain,
        country_code="RO",
        country_name="Romania",
        industry=industry,
        employee_count=employees,
        size_verification=SizeVerification.NEEDS_VERIFICATION,
        discovery_confidence=0.55,
        source_url=f"https://www.wikidata.org/entity/{entity_id}",
    )


def test_catalog_upserts_and_ranks_profile_industries() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        store_candidates(
            session,
            [
                candidate("Q1", "factory.ro", industry="manufacturing", employees=5000),
                candidate("Q2", "secure.ro", industry="cybersecurity", employees=None),
            ],
        )
        session.commit()
        results = CatalogDiscovery(session).discover(
            DiscoveryRequest(country_codes=["RO"], industries=["Cybersecurity"], limit=2)
        )
        assert [item.domain for item in results] == ["secure.ro", "factory.ro"]

        updated = candidate("Q2", "secure.ro", industry="computer security", employees=1200)
        store_candidates(session, [updated])
        session.commit()
        assert (
            CatalogDiscovery(session)
            .discover(DiscoveryRequest(country_codes=["RO"], minimum_employees=1000, limit=5))[0]
            .employee_count
            == 5000
        )
