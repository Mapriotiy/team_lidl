"""Load a reusable public-company catalog from Wikidata.

Run with: python -m app.catalog.sync --limit 5000

The reusable catalog accepts a reported 1,000+ headcount or an unknown-size
company with a substantial public profile. Unknown sizes remain visibly
unverified and research applies the source-coverage gate before qualification.
"""

import argparse
import logging

from sqlalchemy import func, select

from app.db import SessionLocal
from app.discovery import DiscoveryRequest, WikidataDiscovery, WikidataError, store_candidates
from app.models.catalog import CatalogCompany

EUROPE_COUNTRIES = (
    "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE XK LV LI LT LU MT MD MC ME "
    "NL MK NO PL PT RO SM RS SK SI ES SE CH TR UA GB"
).split()


def sync_catalog(
    *, limit: int, countries: list[str], page_size: int = 200, minimum_statements: int = 15
) -> int:
    provider = WikidataDiscovery(timeout=30)
    added = 0
    for country in countries:
        offset = 0
        pages = 0
        while added < limit and pages < 100:
            request = DiscoveryRequest(
                country_codes=[country],
                minimum_employees=1000,
                include_unknown_size=True,
                limit=50,
            )
            try:
                candidates = provider.discover(
                    request,
                    page_limit=min(page_size, limit - added),
                    offset=offset,
                    minimum_statements=minimum_statements,
                    require_scale_indicator=False,
                )
            except WikidataError as exc:
                logging.warning("Catalog page failed for %s at %s: %s", country, offset, exc)
                break
            if not candidates:
                break
            with SessionLocal.begin() as session:
                before = session.scalar(select(func.count()).select_from(CatalogCompany)) or 0
                store_candidates(session, candidates)
                session.flush()
                after = session.scalar(select(func.count()).select_from(CatalogCompany)) or 0
            added += after - before
            logging.info("Catalog contains %s companies after %s offset %s", after, country, offset)
            offset += page_size
            pages += 1
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize the local company catalog")
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--page-size", type=int, default=200)
    parser.add_argument("--countries", nargs="*", default=EUROPE_COUNTRIES)
    parser.add_argument("--minimum-statements", type=int, default=15)
    args = parser.parse_args()
    if (
        not 1 <= args.limit <= 100_000
        or not 25 <= args.page_size <= 500
        or not 8 <= args.minimum_statements <= 500
    ):
        parser.error("limit must be 1–100000 and page-size must be 25–500")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    added = sync_catalog(
        limit=args.limit,
        countries=args.countries,
        page_size=args.page_size,
        minimum_statements=args.minimum_statements,
    )
    logging.info("Catalog sync finished; %s new companies added", added)


if __name__ == "__main__":
    main()
