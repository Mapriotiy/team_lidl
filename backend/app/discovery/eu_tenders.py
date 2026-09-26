"""EU Funding & Tenders portal calls, as a market-level signal rather than company news.

The portal is a single-page app over the public SEDIA search API. Calls are published by
EU bodies, so searching by a company name never matches; queries are topical and the
result describes demand in a service area, not a specific prospect.
"""

import html
import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Literal, Protocol
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

SEDIA_ENDPOINT = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
# Public constant used by the portal itself; it is not an account credential.
SEDIA_API_KEY = "SEDIA"
PORTAL_HOST = "ec.europa.eu"
# Official SEDIA "All grants and tenders" lanes: procurement, direct grants,
# external-action grants and cascade funding.
CALL_TYPES = ["0", "1", "2", "8"]
STATUS_FORTHCOMING = "31094501"
STATUS_OPEN = "31094502"
MAX_PAGE_SIZE = 50
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
_HREF = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)


class EuTendersError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class EuTendersTransport(Protocol):
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object: ...


class UrlLibEuTendersTransport:
    def post_multipart(
        self,
        url: str,
        *,
        fields: Mapping[str, tuple[str, bool]],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        boundary = "----LeadRadarBoundary"
        body = ""
        for name, (value, as_json_file) in fields.items():
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
            if as_json_file:
                body += '; filename="blob"\r\nContent-Type: application/json'
            body += f"\r\n\r\n{value}\r\n"
        body += f"--{boundary}--\r\n"
        request = Request(
            url,
            data=body.encode("utf-8"),
            method="POST",
            headers={
                **headers,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS endpoint
                if response.status != 200:
                    raise EuTendersError(f"EU tenders portal returned HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code in {429, 500, 502, 503, 504}:
                raise EuTendersError(
                    f"EU tenders portal returned HTTP {exc.code}", retryable=True
                ) from exc
            raise EuTendersError(f"EU tenders portal returned HTTP {exc.code}") from exc


class TenderCall(BaseModel):
    identifier: str
    title: str
    url: str
    status: str
    start_date: datetime | None = None
    deadline: datetime | None = None
    programme: str | None = None
    summary: str = Field(default="", max_length=600)
    opportunity_type: Literal[
        "public_procurement", "funding_call", "cascade_funding", "market_consultation", "unknown"
    ] = "unknown"
    budget: float | None = None


class TenderSearchResult(BaseModel):
    query: str
    total: int
    calls: list[TenderCall]
    retrieved_at: datetime


def _first(value: object) -> str | None:
    if isinstance(value, list):
        value = value[0] if value else None
    return value if isinstance(value, str) and value.strip() else None


def _date(value: object) -> datetime | None:
    raw = _first(value)
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw.replace("+0000", "+00:00"))
    except ValueError:
        return None


def _summary(value: object) -> str:
    raw = _first(value) or ""
    text = _SPACE.sub(" ", html.unescape(_TAG.sub(" ", raw))).strip()
    return text[:600]


def _portal_url(value: object) -> str | None:
    url = _first(value)
    if url is None or not url.startswith(f"https://{PORTAL_HOST}/"):
        return None
    return url.split("#", 1)[0]


def _external_call_url(metadata: Mapping[str, object]) -> str | None:
    for field in ("furtherInformation", "beneficiaryAdministration", "destinationDetails"):
        raw = _first(metadata.get(field)) or ""
        for match in _HREF.finditer(html.unescape(raw)):
            candidate = match.group(1)
            parsed = urlparse(candidate)
            if parsed.scheme == "https" and parsed.hostname and parsed.hostname != PORTAL_HOST:
                return candidate.split("#", 1)[0]
    return None


def _public_call_url(item: Mapping[str, object], metadata: Mapping[str, object]) -> str | None:
    portal_url = _portal_url(item.get("url"))
    if portal_url is None:
        return None
    if "/competitive-calls-cs/" in portal_url:
        return _external_call_url(metadata)
    return portal_url


_PROGRAMME_PREFIXES = {
    "CEF": "Connecting Europe Facility",
    "DIGITAL": "Digital Europe Programme",
    "ERASMUS": "Erasmus+",
    "EU4H": "EU4Health",
    "HORIZON": "Horizon Europe",
    "LIFE": "LIFE Programme",
    "SMP": "Single Market Programme",
}


def _programme(value: object, identifier: str) -> str | None:
    programme = _first(value)
    if programme is not None and not programme.isdigit():
        return programme
    prefix = identifier.split("-", 1)[0].upper()
    return _PROGRAMME_PREFIXES.get(prefix)


def _number(value: object) -> float | None:
    raw = _first(value)
    if raw is None:
        return None
    try:
        number = float(raw.replace(",", "").strip())
    except ValueError:
        return None
    return number if number >= 0 else None


def _opportunity_type(portal_url: str) -> str:
    if "/competitive-calls-cs/" in portal_url:
        return "cascade_funding"
    if "/tender-details/" in portal_url or "/calls-for-tenders" in portal_url:
        return "public_procurement"
    if "consultation" in portal_url:
        return "market_consultation"
    if "/opportunities/" in portal_url:
        return "funding_call"
    return "unknown"


def _query_terms(query: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"[a-z0-9-]{3,}", query.casefold())))


def _relevance(
    title: str, summary: str, terms: list[str], minimum_matches: int | None = None
) -> int:
    title_text = title.casefold()
    body_text = f"{title} {summary}".casefold()
    matched = [term for term in terms if term in body_text]
    if minimum_matches is None:
        minimum_matches = 2 if len(terms) > 1 else 1
    if len(matched) < minimum_matches:
        return 0
    return sum(3 if term in title_text else 1 for term in matched)


class EuTendersDiscovery:
    def __init__(
        self,
        transport: EuTendersTransport | None = None,
        *,
        timeout: float = 20,
        max_page_size: int = MAX_PAGE_SIZE,
    ) -> None:
        if not 1 <= max_page_size <= MAX_PAGE_SIZE:
            raise ValueError(f"EU tenders page size must be between 1 and {MAX_PAGE_SIZE}")
        self.transport = transport or UrlLibEuTendersTransport()
        self.timeout = timeout
        self.max_page_size = max_page_size

    def search(
        self,
        query: str,
        *,
        limit: int = 10,
        include_forthcoming: bool = True,
        language: str = "en",
    ) -> TenderSearchResult:
        return self.search_many(
            [query], limit=limit, include_forthcoming=include_forthcoming, language=language
        )

    def search_many(
        self,
        queries: list[str],
        *,
        relevance_terms: list[str] | None = None,
        limit: int = 10,
        include_forthcoming: bool = True,
        language: str = "en",
    ) -> TenderSearchResult:
        """Merge several synonym queries; SEDIA matches single terms far better than phrases."""
        cleaned = list(dict.fromkeys(_SPACE.sub(" ", q).strip() for q in queries if q.strip()))
        if not cleaned:
            raise ValueError("EU tenders query must not be blank")
        if not 1 <= limit <= self.max_page_size:
            raise ValueError(f"EU tenders limit must be between 1 and {self.max_page_size}")
        terms = [t.casefold() for t in relevance_terms] if relevance_terms else None
        ranked: dict[str, tuple[int, TenderCall]] = {}
        total = 0
        retrieved_at = datetime.now(UTC)
        for query in cleaned:
            query_total, calls = self._search_one(
                query,
                terms if terms is not None else _query_terms(query),
                minimum_matches=1 if terms is not None else None,
                include_forthcoming=include_forthcoming,
                language=language,
                now=retrieved_at,
            )
            total += query_total
            for relevance, call in calls:
                if call.url not in ranked or ranked[call.url][0] < relevance:
                    ranked[call.url] = (relevance, call)
        ordered = sorted(
            ranked.values(),
            key=lambda item: (-item[0], item[1].deadline or datetime.max.replace(tzinfo=UTC)),
        )
        return TenderSearchResult(
            query=" | ".join(cleaned),
            total=total,
            calls=[call for _, call in ordered[:limit]],
            retrieved_at=retrieved_at,
        )

    def _search_one(
        self,
        query: str,
        terms: list[str],
        *,
        minimum_matches: int | None,
        include_forthcoming: bool,
        language: str,
        now: datetime,
    ) -> tuple[int, list[tuple[int, TenderCall]]]:
        statuses = [STATUS_OPEN, STATUS_FORTHCOMING] if include_forthcoming else [STATUS_OPEN]
        filters = {
            "bool": {
                "must": [
                    {"terms": {"type": CALL_TYPES}},
                    {"terms": {"status": statuses}},
                    {"terms": {"language": [language]}},
                ]
            }
        }
        params = {
            "apiKey": SEDIA_API_KEY,
            "text": query,
            # SEDIA relevance is intentionally broad. Retrieve a larger candidate set,
            # then enforce profile-term relevance and the requested limit locally.
            "pageSize": str(self.max_page_size),
            "pageNumber": "1",
        }
        payload = self._request(f"{SEDIA_ENDPOINT}?{urlencode(params)}", filters)
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise EuTendersError("EU tenders portal returned an invalid response")
        total = payload.get("totalResults")
        ranked_calls: list[tuple[int, TenderCall]] = []
        # Cascade open calls share their parent topic identifier, so the public URL is the key.
        seen: set[str] = set()
        for item in payload["results"]:
            if not isinstance(item, dict):
                continue
            metadata = item.get("metadata")
            if not isinstance(metadata, dict):
                continue
            identifier = _first(metadata.get("identifier"))
            portal_url = _portal_url(item.get("url"))
            url = _public_call_url(item, metadata)
            title = _first(metadata.get("callTitle")) or _first(item.get("title"))
            if (
                identifier is None
                or url is None
                or portal_url is None
                or title is None
                or url in seen
            ):
                continue
            seen.add(url)
            status = _first(metadata.get("status"))
            deadline = _date(metadata.get("deadlineDate"))
            if deadline is not None and deadline < now:
                continue
            summary = _summary(metadata.get("description"))
            clean_title = _SPACE.sub(" ", html.unescape(title)).strip()[:300]
            relevance = _relevance(clean_title, summary, terms, minimum_matches)
            if relevance == 0:
                continue
            ranked_calls.append(
                (
                    relevance,
                    TenderCall(
                        identifier=identifier,
                        title=clean_title,
                        url=url,
                        status="forthcoming" if status == STATUS_FORTHCOMING else "open",
                        start_date=_date(metadata.get("startDate")),
                        deadline=deadline,
                        programme=_programme(metadata.get("frameworkProgramme"), identifier),
                        summary=summary,
                        opportunity_type=_opportunity_type(portal_url),
                        budget=_number(metadata.get("budget")),
                    ),
                )
            )
        reported = total if isinstance(total, int) and total >= 0 else len(ranked_calls)
        return reported, ranked_calls

    def _request(self, url: str, filters: Mapping[str, object]) -> object:
        fields = {"query": (json.dumps(filters), True)}
        headers = {"User-Agent": "LeadRadarResearch/0.1 (public tenders search)"}
        try:
            try:
                return self.transport.post_multipart(
                    url, fields=fields, headers=headers, timeout=self.timeout
                )
            except EuTendersError as exc:
                if not exc.retryable:
                    raise
                return self.transport.post_multipart(
                    url, fields=fields, headers=headers, timeout=self.timeout
                )
        except EuTendersError:
            raise
        except Exception as exc:
            raise EuTendersError("EU tenders search failed") from exc
