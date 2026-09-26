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
from typing import Protocol
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

SEDIA_ENDPOINT = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
# Public constant used by the portal itself; it is not an account credential.
SEDIA_API_KEY = "SEDIA"
PORTAL_HOST = "ec.europa.eu"
CALL_TYPE_TENDER = "8"
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
        for candidate in _HREF.findall(html.unescape(raw)):
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


def _programme(value: object) -> str | None:
    programme = _first(value)
    if programme is None or programme.isdigit():
        return None
    return programme


def _query_terms(query: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"[a-z0-9-]{3,}", query.casefold())))


def _relevance(title: str, summary: str, terms: list[str]) -> int:
    title_text = title.casefold()
    body_text = f"{title} {summary}".casefold()
    matched = [term for term in terms if term in body_text]
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
        query = _SPACE.sub(" ", query).strip()
        if not query:
            raise ValueError("EU tenders query must not be blank")
        if not 1 <= limit <= self.max_page_size:
            raise ValueError(f"EU tenders limit must be between 1 and {self.max_page_size}")
        statuses = [STATUS_OPEN, STATUS_FORTHCOMING] if include_forthcoming else [STATUS_OPEN]
        filters = {
            "bool": {
                "must": [
                    {"terms": {"type": [CALL_TYPE_TENDER]}},
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
            "sortBy": "startDate",
            "order": "DESC",
        }
        payload = self._request(f"{SEDIA_ENDPOINT}?{urlencode(params)}", filters)
        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise EuTendersError("EU tenders portal returned an invalid response")
        total = payload.get("totalResults")
        ranked_calls: list[tuple[int, TenderCall]] = []
        seen: set[str] = set()
        query_terms = _query_terms(query)
        retrieved_at = datetime.now(UTC)
        for item in payload["results"]:
            if not isinstance(item, dict):
                continue
            metadata = item.get("metadata")
            if not isinstance(metadata, dict):
                continue
            identifier = _first(metadata.get("identifier"))
            url = _public_call_url(item, metadata)
            title = _first(metadata.get("callTitle")) or _first(item.get("title"))
            if identifier is None or url is None or title is None or identifier in seen:
                continue
            seen.add(identifier)
            status = _first(metadata.get("status"))
            deadline = _date(metadata.get("deadlineDate"))
            if deadline is not None and deadline < retrieved_at:
                continue
            summary = _summary(metadata.get("description"))
            clean_title = _SPACE.sub(" ", html.unescape(title)).strip()[:300]
            relevance = _relevance(clean_title, summary, query_terms)
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
                    programme=_programme(metadata.get("frameworkProgramme")),
                    summary=summary,
                    ),
                )
            )
        ranked_calls.sort(
            key=lambda item: (
                -item[0],
                item[1].deadline or datetime.max.replace(tzinfo=UTC),
            ),
        )
        calls = [call for _, call in ranked_calls[:limit]]
        return TenderSearchResult(
            query=query,
            total=total if isinstance(total, int) and total >= 0 else len(calls),
            calls=calls,
            retrieved_at=retrieved_at,
        )

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
