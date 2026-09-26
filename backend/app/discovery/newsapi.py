import json
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from app.collection.models import SourceTarget
from app.contracts.evidence import SourceType
from app.discovery.gdelt import NewsCandidate

NEWSAPI_ENDPOINT = "https://eventregistry.org/api/v1/article/getArticles"


@dataclass
class NewsApiError(RuntimeError):
    retryable: bool = False


class NewsApiDiscovery:
    def __init__(self, api_key: str, timeout: float = 15) -> None:
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, keyword: str, limit: int) -> list[NewsCandidate]:
        payload = json.dumps(
            {
                "action": "getArticles",
                "keyword": keyword,
                "articlesPage": 1,
                "articlesCount": min(limit, 100),
                "articlesSortBy": "date",
                "articlesSortByAsc": False,
                "dataType": ["news"],
                "forceMaxDataTimeWindow": 31,
                "resultType": "articles",
                "apiKey": self.api_key,
            }
        ).encode()
        request = Request(
            NEWSAPI_ENDPOINT,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310
                if response.status != 200:
                    raise NewsApiError(f"NewsAPI returned HTTP {response.status}")
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code == 429:
                raise NewsApiError("NewsAPI rate limit reached", retryable=True) from exc
            raise NewsApiError(f"NewsAPI returned HTTP {exc.code}") from exc
        except NewsApiError:
            raise
        except Exception as exc:
            raise NewsApiError("NewsAPI request failed") from exc

        articles = body.get("articles", {}).get("results", [])
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
            seen_urls.add(url)
            lang = article.get("lang")
            date = article.get("dateTime")
            results.append(
                NewsCandidate(
                    target=SourceTarget(url=url, source_type=SourceType.NEWS),
                    title=title,
                    language=lang if isinstance(lang, str) else None,
                    seen_date=date if isinstance(date, str) else None,
                )
            )
        return results[:limit]

    def discover(self, company_name: str, *, limit: int = 5) -> list[NewsCandidate]:
        return self._request(company_name.strip(), limit)

    def discover_queries(
        self,
        queries: list[str],
        *,
        limit_per_query: int = 5,
        max_results: int = 18,
    ) -> list[NewsCandidate]:
        if not queries or max_results <= 0:
            return []
        candidates: list[NewsCandidate] = []
        seen_urls: set[str] = set()
        host_counts: dict[str, int] = {}
        for query in queries:
            try:
                batch = self._request(query, limit_per_query)
            except NewsApiError:
                continue
            for candidate in batch:
                url = candidate.target.url
                host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
                if url in seen_urls or host_counts.get(host, 0) >= 3:
                    continue
                seen_urls.add(url)
                host_counts[host] = host_counts.get(host, 0) + 1
                candidates.append(candidate)
                if len(candidates) >= max_results:
                    return candidates
        return candidates
