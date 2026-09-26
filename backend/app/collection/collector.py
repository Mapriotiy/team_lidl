"""Bounded source collection, returning successes alongside structured per-source errors."""

import hashlib
import http.client
import time
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
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
        concurrency: int = 1,
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
        if not 1 <= concurrency <= 4:
            raise ValueError("Collection concurrency must be between 1 and 4")
        self.concurrency = concurrency

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
        if self.concurrency > 1:
            return self._collect_parallel(company, sources)
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

    def _collect_parallel(
        self, company: CanonicalCompany, targets: Sequence[SourceTarget]
    ) -> CollectionResult:
        """Fetch bounded waves, then merge results in input order for stable deduplication.

        A one-page child uses the same redirect, DNS and retention checks. Planning
        is captured from that page's transport response and scheduled centrally, so
        workers never multiply the global page budget or mutate shared result lists.
        """
        pending = list(targets)
        scheduled: set[str] = set()
        seen_hashes: set[str] = set()
        documents: list[CollectedDocument] = []
        errors: list[CollectionError] = []
        total = 0
        parent_transport = self.transport

        def fetch(target: SourceTarget) -> tuple[CollectionResult, list[SourceTarget]]:
            plans: list[SourceTarget] = []

            class PlanningTransport:
                def fetch(self, url: str, *, timeout: float, max_bytes: int) -> FetchResponse:
                    response = parent_transport.fetch(url, timeout=timeout, max_bytes=max_bytes)
                    # Child validates and extracts this response before plans are used.
                    if (
                        200 <= response.status < 300
                        and target.source_type
                        in {SourceType.COMPANY, SourceType.CAREERS, SourceType.REPORT}
                        and "html" in response.headers.get("content-type", "").lower()
                    ):
                        try:
                            plans.extend(plan_first_party_sources(response.body, url, limit=5))
                        except (ValueError, AssertionError):
                            pass  # Malformed links must not discard valid page text.
                    return response

            child = PublicSourceCollector(
                PlanningTransport(),
                max_pages=1,
                timeout=self.timeout,
                max_bytes=self.max_bytes,
                max_redirects=self.max_redirects,
            )
            result = child.collect(company, [target])
            return result, plans if result.documents else []

        with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
            while pending and total < self.max_pages:
                wave: list[SourceTarget] = []
                while pending and len(wave) < min(self.concurrency, self.max_pages - total):
                    target = pending.pop(0)
                    try:
                        url = canonical_url(target.url)
                    except CollectionFailure as exc:
                        errors.append(CollectionError(target.url, exc.code, str(exc)))
                        continue
                    if url in scheduled:
                        continue
                    scheduled.add(url)
                    wave.append(target)
                total += len(wave)
                for result, plans in pool.map(fetch, wave):
                    errors.extend(result.errors)
                    for document in result.documents:
                        scheduled.add(document.canonical_url)
                        if document.content_hash not in seen_hashes:
                            documents.append(document)
                            seen_hashes.add(document.content_hash)
                    pending.extend(plans)
        if any(target.url not in scheduled for target in pending):
            errors.append(CollectionError("", "page_limit", "Additional sources were not fetched"))
        return CollectionResult(tuple(documents), tuple(errors), total)
