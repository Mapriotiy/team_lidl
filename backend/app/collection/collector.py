"""Bounded source collection, returning successes alongside structured per-source errors."""

import hashlib
import http.client
import time
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Protocol
from urllib.parse import urljoin, urlsplit

from app.collection.extraction import extract
from app.collection.models import (
    CanonicalCompany,
    CollectedDocument,
    CollectionError,
    CollectionFailure,
    CollectionResult,
    SourceTarget,
)
from app.collection.planning import plan_first_party_sources
from app.collection.safety import canonical_domain, canonical_url
from app.collection.transport import FetchResponse, SafeHTTPTransport
from app.contracts.evidence import SourceType


class Transport(Protocol):
    def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse: ...


class PublicSourceCollector:
    def __init__(
        self,
        transport: Transport | None = None,
        *,
        max_pages: int = 10,
        timeout: float = 10,
        max_bytes: int = 1_000_000,
        max_redirects: int = 4,
    ) -> None:
        if not 1 <= max_pages <= 24 or not 0 < timeout <= 30:
            raise ValueError("Collection permits 1–24 pages and a 0–30 second page deadline")
        if not 1 <= max_bytes <= 2_000_000 or not 0 <= max_redirects <= 5:
            raise ValueError("Invalid byte or redirect limit")
        self.transport = transport if transport is not None else SafeHTTPTransport()
        self.max_pages = max_pages
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects

    def collect(
        self, company: CanonicalCompany, targets: Sequence[SourceTarget] | None = None
    ) -> CollectionResult:
        try:
            domains = {
                canonical_domain(value) for value in (company.canonical_domain, *company.aliases)
            }
            domain = canonical_domain(company.canonical_domain)
        except CollectionFailure as exc:
            return CollectionResult(
                (), (CollectionError(company.canonical_domain, exc.code, str(exc)),)
            )
        sources = list(targets) if targets is not None else [SourceTarget(f"https://{domain}/")]
        documents: list[CollectedDocument] = []
        errors: list[CollectionError] = []
        seen_urls: set[str] = set()
        seen_hashes: set[str] = set()
        if len(sources) > self.max_pages:
            errors.append(CollectionError("", "page_limit", "Additional sources were not fetched"))
            sources = sources[: self.max_pages]
        for target in sources:
            try:
                url = canonical_url(target.url)
                if url in seen_urls:
                    continue
                deadline = time.monotonic() + self.timeout
                chain: set[str] = set()
                for hop in range(self.max_redirects + 1):
                    host = urlsplit(url).hostname or ""
                    if target.source_type in {
                        SourceType.COMPANY,
                        SourceType.CAREERS,
                        SourceType.REPORT,
                    } and not any(host == name or host.endswith("." + name) for name in domains):
                        raise CollectionFailure(
                            "identity_mismatch", "Source is outside company domains"
                        )
                    if url in chain:
                        raise CollectionFailure("redirect_loop", "Redirect loop detected")
                    if url in seen_urls:
                        break
                    chain.add(url)
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise CollectionFailure("timeout", "Source deadline exceeded")
                    response = self.transport.fetch(
                        url, timeout=remaining, max_bytes=self.max_bytes
                    )
                    if response.status in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise CollectionFailure("invalid_redirect", "Redirect lacks Location")
                        if hop == self.max_redirects:
                            raise CollectionFailure("redirect_limit", "Redirect limit exceeded")
                        url = canonical_url(urljoin(url, location))
                        continue
                    if not 200 <= response.status < 300:
                        raise CollectionFailure("http_error", f"HTTP {response.status}")
                    if len(response.body) > self.max_bytes:
                        raise CollectionFailure("content_too_large", "Source exceeds byte limit")
                    directives = response.headers.get("x-robots-tag", "").lower()
                    if any(token in directives for token in ("noarchive", "nosnippet", "none")):
                        raise CollectionFailure(
                            "retention_restricted", "Source restricts retained text"
                        )
                    extracted = extract(response.body, response.headers.get("content-type", ""))
                    if not extracted.text:
                        raise CollectionFailure("empty_content", "No permitted text extracted")
                    digest = hashlib.sha256(extracted.text.encode()).hexdigest()
                    if digest not in seen_hashes:
                        documents.append(
                            CollectedDocument(
                                id=hashlib.sha256(
                                    f"{company.id}:{url}:{digest}".encode()
                                ).hexdigest(),
                                company_id=company.id,
                                canonical_url=url,
                                source_type=target.source_type,
                                title=extracted.title,
                                retrieved_at=datetime.now(UTC),
                                publication_date=extracted.publication_date,
                                event_date=extracted.event_date,
                                content_hash=digest,
                                normalized_text=extracted.text,
                            )
                        )
                        seen_hashes.add(digest)
                    if (
                        target.source_type
                        in {SourceType.COMPANY, SourceType.CAREERS, SourceType.REPORT}
                        and "html" in response.headers.get("content-type", "").lower()
                    ):
                        remaining_slots = self.max_pages - len(sources)
                        if remaining_slots > 0:
                            sources.extend(
                                plan_first_party_sources(
                                    response.body,
                                    url,
                                    limit=remaining_slots,
                                )
                            )
                    break
                seen_urls.update(chain)
            except CollectionFailure as exc:
                errors.append(CollectionError(target.url, exc.code, str(exc)))
            except (OSError, http.client.HTTPException) as exc:
                # Do not persist arbitrary server/proxy text or credentials in errors.
                code = "timeout" if isinstance(exc, TimeoutError) else "fetch_error"
                errors.append(CollectionError(target.url, code, "Public source retrieval failed"))
        return CollectionResult(tuple(documents), tuple(errors), len(sources))
