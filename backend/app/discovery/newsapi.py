import json
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Protocol
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from app.collection.models import SourceTarget
from app.contracts.evidence import SourceType
from app.discovery.gdelt import NewsCandidate

NEWSAPI_ENDPOINT = "https://newsapi.org/v2/everything"
# The free newsapi.org plan only serves articles from the last month.
NEWSAPI_MAX_WINDOW_DAYS = 29


class NewsApiError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class NewsApiTransport(Protocol):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object: ...


class UrlLibNewsApiTransport:
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        request = Request(f"{url}?{urlencode(params)}", headers=dict(headers))
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS endpoint
                if response.status != 200:
                    raise NewsApiError(f"NewsAPI returned HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code == 429:
                raise NewsApiError("NewsAPI rate limit reached", retryable=True) from exc
            if exc.code in {401, 426}:
                raise NewsApiError("NewsAPI rejected the API key or plan") from exc
            raise NewsApiError(f"NewsAPI returned HTTP {exc.code}") from exc


class NewsApiDiscovery:
    def __init__(
        self,
        api_key: str,
        transport: NewsApiTransport | None = None,
        timeout: float = 15,
    ) -> None:
        if not api_key.strip():
            raise ValueError("NewsAPI requires an API key")
        self.api_key = api_key.strip()
        self.transport = transport or UrlLibNewsApiTransport()
        self.timeout = timeout

    def _discover_query(self, query: str, *, limit: int) -> list[NewsCandidate]:
        if not 1 <= limit <= 100:
            raise ValueError("NewsAPI result limit must be between 1 and 100")
        since = datetime.now(UTC) - timedelta(days=NEWSAPI_MAX_WINDOW_DAYS)
        params = {
            "q": query,
            "searchIn": "title,description",
            "from": since.strftime("%Y-%m-%d"),
            "sortBy": "publishedAt",
            "pageSize": str(limit),
        }
        headers = {"X-Api-Key": self.api_key, "User-Agent": "LeadRadarResearch/0.1"}
        try:
            try:
                payload = self.transport.get_json(
                    NEWSAPI_ENDPOINT, params=params, headers=headers, timeout=self.timeout
                )
            except NewsApiError as exc:
                if not exc.retryable:
                    raise
                payload = self.transport.get_json(
                    NEWSAPI_ENDPOINT, params=params, headers=headers, timeout=self.timeout
                )
        except NewsApiError:
            raise
        except Exception as exc:
            raise NewsApiError("NewsAPI news discovery failed") from exc
        if not isinstance(payload, dict) or payload.get("status") != "ok":
            raise NewsApiError("NewsAPI returned an invalid response")
        articles = payload.get("articles")
        if not isinstance(articles, list):
            raise NewsApiError("NewsAPI returned an invalid response")

        results: list[NewsCandidate] = []
        seen_urls: set[str] = set()
        for article in articles:
            if not isinstance(article, dict):
                continue
            url = article.get("url")
            title = article.get("title")
            if not isinstance(url, str) or not isinstance(title, str) or url in seen_urls:
                continue
            if title == "[Removed]":
                continue
            seen_urls.add(url)
            published = article.get("publishedAt")
            results.append(
                NewsCandidate(
                    target=SourceTarget(url=url, source_type=SourceType.NEWS),
                    title=title,
                    language=None,
                    seen_date=published if isinstance(published, str) else None,
                )
            )
        return results[:limit]

    def discover(self, company_name: str, *, limit: int = 5) -> list[NewsCandidate]:
        return self._discover_query(f'"{company_name.strip()}"', limit=limit)

    def discover_queries(
        self,
        queries: list[str],
        *,
        limit_per_query: int = 5,
        max_results: int = 18,
    ) -> list[NewsCandidate]:
        """Search several angles and retain a diverse set of full-page targets."""
        if not queries or max_results <= 0:
            return []
        candidates: list[NewsCandidate] = []
        seen_urls: set[str] = set()
        host_counts: dict[str, int] = {}
        last_error: NewsApiError | None = None
        for query in queries:
            try:
                query_candidates = self._discover_query(query, limit=limit_per_query)
            except NewsApiError as exc:
                last_error = exc
                # Quota, rate limit and key errors affect every remaining query alike.
                break
            for candidate in query_candidates:
                url = candidate.target.url
                host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
                if url in seen_urls or host_counts.get(host, 0) >= 3:
                    continue
                seen_urls.add(url)
                host_counts[host] = host_counts.get(host, 0) + 1
                candidates.append(candidate)
                if len(candidates) >= max_results:
                    return candidates
        if not candidates and last_error is not None:
            raise last_error
        return candidates
