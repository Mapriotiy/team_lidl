from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.discovery.models import DiscoveryCandidate, DiscoveryRequest, SizeVerification
from app.models.catalog import CatalogCompany
from app.models.profile import utc_now


def store_candidates(session: Session, candidates: list[DiscoveryCandidate]) -> int:
    """Upsert public company metadata without overwriting researched company records."""
    stored = 0
    for candidate in candidates:
        row = session.scalar(
            select(CatalogCompany).where(
                or_(
                    CatalogCompany.entity_id == candidate.entity_id,
                    CatalogCompany.domain == candidate.domain,
                )
            )
        )
        if row is None:
            row = CatalogCompany(entity_id=candidate.entity_id, domain=candidate.domain)
            session.add(row)
            stored += 1
        row.display_name = candidate.name
        row.country_code = candidate.country_code
        row.country_name = candidate.country_name
        row.industry = candidate.industry
        row.employee_count = candidate.employee_count
        row.website_url = f"https://{candidate.domain}"
        row.source_url = candidate.source_url
        row.updated_at = utc_now()
    session.flush()
    return stored


class CatalogDiscovery:
    def __init__(self, session: Session) -> None:
        self.session = session

    def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
        query = select(CatalogCompany)
        if request.country_codes:
            query = query.where(CatalogCompany.country_code.in_(request.country_codes))
        if request.include_unknown_size:
            query = query.where(
                or_(
                    CatalogCompany.employee_count.is_(None),
                    CatalogCompany.employee_count >= request.minimum_employees,
                )
            )
        else:
            query = query.where(CatalogCompany.employee_count >= request.minimum_employees)
        rows = list(
            self.session.scalars(
                query.order_by(CatalogCompany.employee_count.desc().nulls_last()).limit(1000)
            )
        )
        preferences = [term.casefold() for term in request.industries]
        if request.industry:
            preferences.append(request.industry.casefold())
        rows.sort(
            key=lambda row: bool(
                row.industry and any(term in row.industry.casefold() for term in preferences)
            ),
            reverse=True,
        )
        return [
            DiscoveryCandidate(
                entity_id=row.entity_id,
                name=row.display_name,
                domain=row.domain,
                country_code=row.country_code,
                country_name=row.country_name,
                industry=row.industry,
                employee_count=row.employee_count,
                size_verification=SizeVerification.NEEDS_VERIFICATION,
                discovery_confidence=0.55,
                source_url=row.source_url,
            )
            for row in rows[: request.limit]
        ]
