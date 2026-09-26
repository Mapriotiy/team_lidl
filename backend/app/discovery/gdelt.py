import json
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.collection.models import SourceTarget
from app.contracts.evidence import SourceType

GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"


class GdeltError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class GdeltTransport(Protocol):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object: ...


class UrlLibGdeltTransport:
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        request = Request(f"{url}?{urlencode(params)}", headers=dict(headers))
        try:
            with urlopen(
                request, timeout=timeout
            ) as response:  # noqa: S310 - fixed HTTPS endpoint
                if response.status != 200:
                    raise GdeltError(f"GDELT returned HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code == 429:
                raise GdeltError("GDELT rate limit reached", retryable=True) from exc
            raise GdeltError(f"GDELT returned HTTP {exc.code}") from exc


@dataclass(frozen=True)
class NewsCandidate:
    target: SourceTarget
    title: str
    language: str | None
    seen_date: str | None


class GdeltNewsDiscovery:
    def __init__(
        self,
        transport: GdeltTransport | None = None,
        timeout: float = 15,
        *,
        minimum_interval: float = 6,
    ) -> None:
        self.transport = transport or UrlLibGdeltTransport()
        self.timeout = timeout
        self.minimum_interval = minimum_interval
        self._last_request_at: float | None = None

    def _request(self, params: Mapping[str, str]) -> object:
        if self._last_request_at is not None:
            remaining = self.minimum_interval - (time.monotonic() - self._last_request_at)
            if remaining > 0:
                time.sleep(remaining)
        self._last_request_at = time.monotonic()
        return self.transport.get_json(
            GDELT_ENDPOINT,
            params=params,
            headers={"User-Agent": "TeamLIDLResearch/0.1 (public news discovery)"},
            timeout=self.timeout,
        )

    def discover(self, company_name: str, *, limit: int = 5) -> list[NewsCandidate]:
        if not 1 <= limit <= 10:
            raise ValueError("GDELT result limit must be between 1 and 10")
        query = f'"{company_name.strip()}"'
        try:
            params = {
                "query": query,
                "mode": "artlist",
                "maxrecords": str(limit),
                "format": "json",
                "timespan": "3months",
                "sort": "datedesc",
            }
            try:
                payload = self._request(params)
            except GdeltError as exc:
                if not exc.retryable:
                    raise
                payload = self._request(params)
        except GdeltError:
            raise
        except Exception as exc:
            raise GdeltError("GDELT news discovery failed") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("articles"), list):
            raise GdeltError("GDELT returned an invalid response")

        results: list[NewsCandidate] = []
        seen_urls: set[str] = set()
        for article in payload["articles"]:
            if not isinstance(article, dict):
                continue
            url = article.get("url")
            title = article.get("title")
            if not isinstance(url, str) or not isinstance(title, str) or url in seen_urls:
                continue
            seen_urls.add(url)
            language = article.get("language")
            seen_date = article.get("seendate")
            results.append(
                NewsCandidate(
                    target=SourceTarget(url=url, source_type=SourceType.NEWS),
                    title=title,
                    language=language if isinstance(language, str) else None,
                    seen_date=seen_date if isinstance(seen_date, str) else None,
                )
            )
        return results[:limit]
