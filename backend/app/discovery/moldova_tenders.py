"""Search Moldova's official MTender public procurement portal."""

import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Protocol
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.discovery.eu_tenders import EuTendersError, TenderCall, TenderSearchResult

SEARCH_ENDPOINT = "https://mtender.gov.md/search/tenders"
PUBLIC_PORTAL = "https://mtender.gov.md/en/tenders"
ACTIVE_STATUSES = {"active", "clarification", "tendering", "auction"}
_QUERY_STOPWORDS = {"servicii", "serviciu", "dezvoltare", "aplicație", "aplicatie", "proceselor"}
_SPACE = re.compile(r"\s+")


class MoldovaTendersTransport(Protocol):
    def get_json(self, url: str, *, headers: Mapping[str, str], timeout: float) -> object: ...


class UrlLibMoldovaTendersTransport:
    def get_json(self, url: str, *, headers: Mapping[str, str], timeout: float) -> object:
        request = Request(url, headers=dict(headers))
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS host
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise EuTendersError("Moldova MTender search failed", retryable=True) from exc


class MoldovaTendersDiscovery:
    def __init__(
        self,
        transport: MoldovaTendersTransport | None = None,
        *,
        timeout: float = 20,
        page_size: int = 50,
    ) -> None:
        self.transport = transport or UrlLibMoldovaTendersTransport()
        self.timeout = timeout
        self.page_size = page_size

    def search_many(
        self,
        queries: list[str],
        *,
        relevance_terms: list[str] | None = None,
        limit: int = 20,
    ) -> TenderSearchResult:
        cleaned = list(
            dict.fromkeys(_SPACE.sub(" ", value).strip() for value in queries if value.strip())
        )
        if not cleaned:
            raise ValueError("Moldova tender query must not be blank")
        now = datetime.now(UTC)
        period = json.dumps([f"{now.year}-01-01T00:00:00.000Z", f"{now.year}-12-31T23:59:59.999Z"])
        ranked: dict[str, tuple[int, TenderCall]] = {}
        inspected = 0
        for query in cleaned:
            params = urlencode(
                {
                    "titlesOrDescriptions": query,
                    "periodPublished": period,
                    "page": 1,
                    "pageSize": self.page_size,
                    "proceduresOwnerships": json.dumps(["government"]),
                    "proceduresStatuses": json.dumps(sorted(ACTIVE_STATUSES)),
                }
            )
            payload = self.transport.get_json(
                f"{SEARCH_ENDPOINT}?{params}",
                headers={"Accept": "application/json", "User-Agent": "LeadRadarResearch/0.1"},
                timeout=self.timeout,
            )
            if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
                raise EuTendersError("Moldova MTender returned an invalid response")
            inspected += len(payload["data"])
            terms = [
                term
                for term in (
                    [value.casefold() for value in relevance_terms]
                    if relevance_terms
                    else re.findall(r"[\w-]{4,}", query.casefold())
                )
                if term not in _QUERY_STOPWORDS
            ]
            for item in payload["data"]:
                call = self._call(item)
                if call is None:
                    continue
                text = f"{call.title} {call.summary}".casefold()
                matched = [term for term in terms if term in text]
                if not matched or (not relevance_terms and len(terms) > 1 and len(matched) < 2):
                    continue
                relevance = (10 if query.casefold() in text else 0) + sum(
                    3 if term in call.title.casefold() else 1 for term in matched
                )
                if relevance and (call.url not in ranked or relevance > ranked[call.url][0]):
                    ranked[call.url] = (relevance, call)
        ordered = sorted(ranked.values(), key=lambda value: (-value[0], value[1].title.casefold()))
        return TenderSearchResult(
            query=" | ".join(cleaned),
            total=inspected,
            calls=[call for _, call in ordered[:limit]],
            retrieved_at=now,
        )

    @staticmethod
    def _call(item: object) -> TenderCall | None:
        if not isinstance(item, dict):
            return None
        identifier = item.get("id")
        title = item.get("title")
        status = item.get("procedureStatus")
        if (
            not isinstance(identifier, str)
            or not isinstance(title, str)
            or status not in ACTIVE_STATUSES
        ):
            return None
        description = item.get("description") if isinstance(item.get("description"), str) else ""
        buyer = item.get("buyerName") if isinstance(item.get("buyerName"), str) else "Unknown buyer"
        region = item.get("buyerRegion") if isinstance(item.get("buyerRegion"), str) else "Moldova"
        procedure = (
            item.get("procedureType")
            if isinstance(item.get("procedureType"), str)
            else "procurement"
        )
        amount = item.get("amount")
        budget = float(amount) if isinstance(amount, (int, float)) and amount >= 0 else None
        return TenderCall(
            identifier=identifier,
            title=_SPACE.sub(" ", title).strip()[:300],
            url=f"{PUBLIC_PORTAL}/{identifier}",
            status="open",
            programme=f"MTender · {buyer} · {region}",
            summary=_SPACE.sub(
                " ", f"{description} Buyer: {buyer}. Procedure: {procedure}."
            ).strip()[:600],
            opportunity_type="public_procurement",
            budget=budget,
            currency=item.get("currency") if isinstance(item.get("currency"), str) else "MDL",
            source="moldova",
        )
