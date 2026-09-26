from collections.abc import Mapping

import pytest

from app.contracts.evidence import SourceType
from app.discovery import NewsApiDiscovery, NewsApiError


class FakeTransport:
    def __init__(self) -> None:
        self.params: Mapping[str, str] = {}
        self.headers: Mapping[str, str] = {}
        self.calls = 0

    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        assert url == "https://newsapi.org/v2/everything"
        self.calls += 1
        self.params = params
        self.headers = headers
        return {
            "status": "ok",
            "totalResults": 4,
            "articles": [
                {
                    "url": "https://news.example/ro/article",
                    "title": "Compania anunta un program nou",
                    "publishedAt": "2026-09-25T12:00:00Z",
                },
                {"url": "https://news.example/ro/article", "title": "Duplicate"},
                {"url": "https://news.example/removed", "title": "[Removed]"},
                {
                    "url": "https://news.example/pl/article",
                    "title": "Firma oglasza transformacje",
                    "publishedAt": "2026-09-24T08:00:00Z",
                },
            ],
        }


def test_discovers_recent_news_with_key_header_and_bounded_window() -> None:
    transport = FakeTransport()
    results = NewsApiDiscovery("secret", transport).discover("Example Company", limit=5)

    assert [item.target.url for item in results] == [
        "https://news.example/ro/article",
        "https://news.example/pl/article",
    ]
    assert results[0].target.source_type == SourceType.NEWS
    assert results[0].seen_date == "2026-09-25T12:00:00Z"
    assert transport.headers["X-Api-Key"] == "secret"
    assert transport.params["q"] == '"Example Company"'
    assert transport.params["pageSize"] == "5"
    assert "from" in transport.params
    assert "apiKey" not in transport.params


def test_rejects_blank_key_and_invalid_limits() -> None:
    with pytest.raises(ValueError):
        NewsApiDiscovery("  ")
    with pytest.raises(ValueError):
        NewsApiDiscovery("secret", FakeTransport()).discover("Example", limit=101)


class RateLimitedOnceTransport(FakeTransport):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        if self.calls == 0:
            self.calls += 1
            raise NewsApiError("NewsAPI rate limit reached", retryable=True)
        return super().get_json(url, params=params, headers=headers, timeout=timeout)


def test_retries_once_after_rate_limit() -> None:
    transport = RateLimitedOnceTransport()
    results = NewsApiDiscovery("secret", transport).discover("Example Company", limit=5)

    assert len(results) == 2
    assert transport.calls == 2


class ErrorStatusTransport(FakeTransport):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        self.calls += 1
        return {"status": "error", "code": "apiKeyInvalid", "message": "Your API key is invalid"}


def test_multi_query_stops_on_first_error_and_reports_it() -> None:
    transport = ErrorStatusTransport()
    discovery = NewsApiDiscovery("secret", transport)

    with pytest.raises(NewsApiError):
        discovery.discover_queries(['"A"', '"A" (rpa OR automation)', '"A" strategy'])
    assert transport.calls == 1


def test_multi_query_deduplicates_and_caps_results() -> None:
    transport = FakeTransport()
    results = NewsApiDiscovery("secret", transport).discover_queries(
        ['"A"', '"A" (rpa OR automation)'], limit_per_query=5, max_results=3
    )

    assert transport.calls == 2
    assert [item.target.url for item in results] == [
        "https://news.example/ro/article",
        "https://news.example/pl/article",
    ]
