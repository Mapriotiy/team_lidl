"""Bounded, deterministic planning of useful first-party pages from one HTML page."""

from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from app.collection.models import SourceTarget
from app.contracts.evidence import SourceType


@dataclass(frozen=True)
class Link:
    href: str
    text: str


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[Link] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            self.links.append(Link(self._href, " ".join("".join(self._text).split())))
            self._href = None
            self._text = []


_CLASSIFIERS: tuple[tuple[SourceType, tuple[str, ...]], ...] = (
    (SourceType.REPORT, ("annual-report", "annual report", "investor", "strategy")),
    (SourceType.CAREERS, ("career", "careers", "jobs", "vacancies", "work-with-us")),
    (SourceType.COMPANY, ("news", "newsroom", "press", "media", "about")),
)


def plan_first_party_sources(
    body: bytes,
    base_url: str,
    *,
    limit: int = 5,
) -> list[SourceTarget]:
    """Select a small, ordered set of relevant links; fetching remains collector-controlled."""
    if limit <= 0:
        return []
    parser = LinkParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    base_host = (urlsplit(base_url).hostname or "").lower()
    candidates: list[tuple[int, str, SourceType]] = []
    seen: set[str] = set()
    for link in parser.links:
        absolute = urljoin(base_url, link.href)
        parsed = urlsplit(absolute)
        host = (parsed.hostname or "").lower()
        if parsed.scheme not in {"http", "https"} or host != base_host:
            continue
        haystack = f"{parsed.path} {link.text}".casefold()
        for priority, (source_type, terms) in enumerate(_CLASSIFIERS):
            if any(term in haystack for term in terms):
                clean = absolute.split("#", 1)[0]
                if clean not in seen:
                    candidates.append((priority, clean, source_type))
                    seen.add(clean)
                break
    candidates.sort(key=lambda item: (item[0], item[1]))
    return [SourceTarget(url, source_type) for _, url, source_type in candidates[:limit]]
