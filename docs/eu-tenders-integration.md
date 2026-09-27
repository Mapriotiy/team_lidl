# EU and Moldova tenders integration

LeadRadar uses the public search API behind the EU Funding & Tenders Portal to find
procurement opportunities that match the active Service Profile. Tender results are a
separate demand channel: they are not treated as company evidence and do not change a
company's prospect score.

The same workspace can search Moldova's official MTender portal. MTender publishes
real-time OCDS 1.1 open contracting data and exposes the public search used by its own
portal interface.

## Enable the integration

Set the feature flag in `.env` and restart the API:

```dotenv
EU_TENDERS_ENABLED=true
MOLDOVA_TENDERS_ENABLED=true
```

```bash
docker compose restart api
```

The public SEDIA search endpoint does not require a user API key. `OPENROUTER_API_KEY`
is not required for tender search or the current evidence analysis. MTender search also
uses public endpoints and requires no credential.

Verify the integration without exposing configuration values:

```bash
curl http://localhost:8000/eu-tenders/status
```

An enabled instance returns `{"id":"eu_tenders",...,"enabled":true}`. When disabled,
the status remains visible but search and analysis are unavailable.

## Product workflow

1. Create or select a Service Profile.
2. Open **Tender opportunities** in the sidebar and choose **EU + Moldova**, **EU only**,
   or **Moldova only**.
3. Run the search. The backend derives several domain queries from the profile, searches
   official procurement records, removes duplicate URLs, and ranks the remaining calls.
4. Review fit dimensions, missing eligibility evidence, risks, deadline and next actions.
5. Choose **Analyze official source** to collect the public page and extract cited facts
   for scope, eligibility, consortium, funding and deadline.

The search is intentionally restricted to the official procurement lane (`type=8`). This
avoids presenting sparse grant shells as bid-ready opportunities. Open and forthcoming
English-language calls are considered; expired calls are removed.

For Moldova, the profile is expanded with Romanian-language service terms. Only current
government procedures in published, clarification, bidding, or auction stages are retained.
Cancelled, awarded, completed, and contract-stage records are excluded. Results preserve
the official MTender URL, buyer, region, procedure type, amount, and MDL currency.

## API

### Status

```http
GET /eu-tenders/status
```

### Profile-based search

```http
GET /eu-tenders/search?profile_id={service_profile_id}&limit=10
```

The response contains the executed query portfolio, raw calls, explainable opportunities,
fit dimensions, risks and warnings. The fit score is capped below bid-ready confidence
until eligibility is supported by call documents.

### Evidence analysis

```http
POST /eu-tenders/analyze
Content-Type: application/json

{
  "call": {
    "identifier": "CALL-ID",
    "title": "Opportunity title",
    "url": "https://ec.europa.eu/...",
    "status": "open",
    "summary": "Published portal summary",
    "opportunity_type": "public_procurement"
  }
}
```

Analysis returns evidence coverage, confidence, supported facts with excerpts, blockers,
next actions and the original source URL. If the source page cannot be collected, the
response explicitly warns that only portal metadata was available.

### Moldova profile-based search

```http
GET /moldova-tenders/search?profile_id={service_profile_id}&limit=20
```

The response follows the same opportunity contract as EU search, with `source=moldova`
and `currency=MDL`, so the frontend can merge and rank both official sources.

## Data and scoring boundaries

- A search hit means relevant public demand, not confirmed supplier eligibility.
- Legal eligibility, consortium rules and certifications require document-level review.
- Missing structured budget or deadline values remain unknown; they are not inferred.
- Public-source excerpts remain linked to their source for inspection.
- The integration does not scrape authenticated pages or require an EU Portal account.
- Search failures return a safe `502` response without leaking upstream details.

## Checks

Run the deterministic integration tests inside the API container:

```bash
docker compose exec -T -e PYTHONPATH=/app api pytest \
  tests/discovery/test_eu_tenders.py \
  tests/test_eu_tenders_api.py \
  tests/test_tender_intelligence.py
```

