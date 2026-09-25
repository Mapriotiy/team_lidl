from collections.abc import Mapping

from app.contracts.evidence import SourceType
from app.discovery import GdeltNewsDiscovery


class FakeTransport:
    def __init__(self) -> None:
        self.params: Mapping[str, str] = {}

    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        assert url == "https://api.gdeltproject.org/api/v2/doc/doc"
        self.params = params
        return {
            "articles": [
                {
                    "url": "https://news.example/ro/article",
                    "title": "Compania anunta un program nou",
                    "language": "Romanian",
                    "seendate": "20260925T120000Z",
                },
                {
                    "url": "https://news.example/ro/article",
                    "title": "Duplicate",
                },
                {
                    "url": "https://news.example/pl/article",
                    "title": "Firma oglasza transformacje",
                    "language": "Polish",
                },
            ]
        }


def test_discovers_recent_native_language_news_without_translation() -> None:
    transport = FakeTransport()
    results = GdeltNewsDiscovery(transport).discover("Example Company", limit=5)

    assert len(results) == 2
    assert results[0].language == "Romanian"
    assert results[1].language == "Polish"
    assert results[0].target.source_type == SourceType.NEWS
    assert transport.params["query"] == '"Example Company"'
    assert transport.params["timespan"] == "3months"
