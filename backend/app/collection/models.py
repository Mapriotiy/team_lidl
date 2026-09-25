"""Collection-only types; source text is untrusted evidence, never instructions."""

from dataclasses import dataclass

from app.contracts.evidence import SourceDocument, SourceType


@dataclass(frozen=True)
class CanonicalCompany:
    id: str
    canonical_domain: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class SourceTarget:
    url: str
    source_type: SourceType = SourceType.COMPANY


class CollectedDocument(SourceDocument):
    normalized_text: str


@dataclass(frozen=True)
class CollectionError:
    url: str
    code: str
    message: str


@dataclass(frozen=True)
class CollectionResult:
    documents: tuple[CollectedDocument, ...]
    errors: tuple[CollectionError, ...]


class CollectionFailure(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
