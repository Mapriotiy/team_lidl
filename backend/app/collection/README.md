# Public source collection

```python
from app.collection import CanonicalCompany, PublicSourceCollector, SourceTarget
from app.contracts.evidence import SourceType

collector = PublicSourceCollector(max_pages=10, timeout=10, max_bytes=1_000_000)
result = collector.collect(
    CanonicalCompany(id="company-id", canonical_domain="example.com"),
    [SourceTarget("https://example.com/"),
     SourceTarget("https://news.example.net/article", SourceType.NEWS)],
)
# Persist result.documents and result.errors independently for partial progress.
```

This synchronous interface belongs in a worker, not an async request loop. Omitting
`targets` retrieves the canonical domain homepage. Aliases are explicitly supplied
verified domain names; first-party company, career and report targets, including
redirects, must stay within these domains or their subdomains. News and industry
sources can be external. Associating an external source with the requested company
is context, not verified company attribution; assessment must verify its text.

`CollectedDocument` extends the existing source contract with `normalized_text`.
Text and metadata are untrusted data. Extraction never executes scripts, models,
embedded instructions, links, or downloads. Script/style/hidden HTML is excluded.
Source IDs are deterministic from company ID, final fetched URL and normalized text
hash. Deduplication is within a collection call by fetched URLs and text hash.
The canonical URL is the validated final retrieval URL, never a page-supplied link.
Publication/event dates come only from explicit metadata and remain null otherwise.
Date-only metadata uses UTC midnight; no date is inferred from retrieval time.

HTTP(S) uses standard ports only. Every redirect and DNS answer is validated, all
non-public addresses are refused, and the socket connects directly to a validated
numeric address. HTTPS retains original-hostname certificate verification/SNI.
No proxies, cookies, authorization, environment credentials, or automatic retries
are used. LinkedIn and all its subdomains are forbidden. Limits are at most ten
input targets, five redirects, two MB per response and thirty seconds per target;
the page deadline is shared across redirects and includes DNS and streamed body.
A watchdog closes stalled sockets. Bounded DNS worker capacity prevents unbounded
resolver-thread growth; an OS DNS call itself cannot be cancelled, but callers time
out and occupied resolver slots reject further work until available.

Limits: static HTML/plain text only, no browser rendering, PDF parsing, discovery,
robots.txt crawler, general CSS visibility evaluation, paywall bypass, login,
automatic domain-alias discovery, semantic event deduplication, assessment or sales
interpretation. Explicit noarchive/nosnippet restrictions prevent retention. Callers
must select permitted public sources and apply their retention policy. Corporate and
news saved fixtures are synthetic test data, not researched account evidence. No live
provider checks were performed. A rejected fetch is an error, never a negative signal.
