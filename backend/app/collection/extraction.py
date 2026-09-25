"""Deterministic extraction only; source content cannot invoke tools or change policy."""

from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser

from app.collection.models import CollectionFailure


@dataclass(frozen=True)
class ExtractedText:
    text: str
    title: str
    publication_date: datetime | None
    event_date: datetime | None


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        result = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        return result if result.tzinfo else result.replace(tzinfo=UTC)
    except ValueError:
        return None


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []
        self.title: list[str] = []
        self.metadata: dict[str, str] = {}
        self.stack: list[tuple[str, bool]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        hidden = (
            tag in {"script", "style", "svg", "template", "noscript", "head"}
            or "hidden" in attributes
            or attributes.get("aria-hidden") == "true"
            or any(item[1] for item in self.stack)
        )
        if tag == "meta":
            name = attributes.get("property") or attributes.get("name")
            if name and attributes.get("content"):
                self.metadata[name.lower()] = attributes["content"] or ""
        if tag not in {
            "area",
            "base",
            "br",
            "col",
            "embed",
            "hr",
            "img",
            "input",
            "link",
            "meta",
            "param",
            "source",
            "track",
            "wbr",
        }:
            self.stack.append((tag, hidden))
        if tag in {"p", "div", "br", "li", "h1", "h2", "h3", "article", "section"}:
            self.text.append(" ")

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break
        self.text.append(" ")

    def handle_data(self, data: str) -> None:
        if any(item[0] == "title" for item in self.stack):
            self.title.append(data)
        if not any(item[1] for item in self.stack):
            self.text.append(data)


def extract(body: bytes, content_type: str) -> ExtractedText:
    # Deterministic UTF-8 fallback; HTTP-declared charsets are honored when known.
    charset = "utf-8"
    for item in content_type.split(";")[1:]:
        if item.strip().lower().startswith("charset="):
            charset = item.split("=", 1)[1].strip(" \"'")
    try:
        decoded = body.decode(charset, errors="replace")
    except LookupError:
        decoded = body.decode("utf-8", errors="replace")
    media_type = content_type.split(";", 1)[0].strip().lower()
    if media_type == "text/plain":
        return ExtractedText(" ".join(decoded.split()), "", None, None)
    if media_type not in {"text/html", "application/xhtml+xml"}:
        raise CollectionFailure("unsupported_content", "Only HTML and plain text are supported")
    parser = TextParser()
    try:
        parser.feed(decoded)
        parser.close()
    except AssertionError as exc:
        # Older Python HTMLParser versions assert on unknown marked declarations.
        raise CollectionFailure("invalid_html", "Source HTML could not be parsed") from exc
    directives = parser.metadata.get("robots", "").lower()
    if any(token in directives for token in ("noarchive", "nosnippet", "none")):
        raise CollectionFailure("retention_restricted", "Source disallows retained snippets")
    return ExtractedText(
        " ".join("".join(parser.text).split()),
        " ".join("".join(parser.title).split()),
        parse_date(
            parser.metadata.get("article:published_time") or parser.metadata.get("datepublished")
        ),
        parse_date(parser.metadata.get("event:start_time")),
    )
