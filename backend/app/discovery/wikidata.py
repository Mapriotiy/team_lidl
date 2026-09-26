import json
from collections.abc import Mapping
from typing import Protocol, cast
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from app.discovery.models import DiscoveryCandidate, DiscoveryRequest, SizeVerification

WIKIDATA_ENDPOINT = "https://qlever.dev/api/wikidata"
WIKIDATA_ENTITY_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "LeadRadarResearch/0.1 (public company discovery)"
LABEL_LANGUAGES = "en|uk|pl|cs|sk|hu|ro|bg|et|lv|lt|ru"

# Employee totals on Wikidata are sourced facts, not values this pipeline has
# verified against a primary source, and some entries record consolidated or
# plainly wrong figures (see docs/research-pipeline-handoff.md). A total above
# this bound cannot be a single company's headcount in the product's target
# market and is presented as unknown company size instead of an asserted fact.
MAX_PLAUSIBLE_EMPLOYEES = 500_000

# Company size is instead stamped needs_verification until our pipeline confirms
# it from primary sources; reduced discovery confidence signals that the size
# fact has not been verified (docs/research-pipeline-handoff.md).
UNVERIFIED_CONFIDENCE = 0.55


class WikidataError(RuntimeError):
    pass


class JsonTransport(Protocol):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object: ...


class LabelResolver(Protocol):
    def resolve(self, entity_ids: set[str], *, timeout: float) -> dict[str, str]: ...


class UrlLibJsonTransport:
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        request = Request(f"{url}?{urlencode(params)}", headers=dict(headers))
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS endpoints
            if response.status != 200:
                raise WikidataError(f"Wikidata returned HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))


class WikidataLabelResolver:
    def __init__(self, transport: JsonTransport | None = None) -> None:
        self.transport = transport or UrlLibJsonTransport()

    def resolve(self, entity_ids: set[str], *, timeout: float) -> dict[str, str]:
        labels: dict[str, str] = {}
        ordered = sorted(entity_ids)
        for offset in range(0, len(ordered), 50):
            batch = ordered[offset : offset + 50]
            payload = self.transport.get_json(
                WIKIDATA_ENTITY_API,
                params={
                    "action": "wbgetentities",
                    "ids": "|".join(batch),
                    "props": "labels",
                    "languages": LABEL_LANGUAGES,
                    "languagefallback": "1",
                    "format": "json",
                },
                headers={"Accept": "application/json", "User-Agent": USER_AGENT},
                timeout=timeout,
            )
            if not isinstance(payload, dict) or not isinstance(payload.get("entities"), dict):
                raise WikidataError("Wikidata label response is invalid")
            for entity_id, raw in payload["entities"].items():
                if not isinstance(raw, dict) or not isinstance(raw.get("labels"), dict):
                    continue
                item_labels = raw["labels"]
                preferred = item_labels.get("en", {})
                fallback: dict[str, object] = next(iter(item_labels.values()), {})
                label = preferred.get("value") or fallback.get("value")
                if isinstance(label, str):
                    labels[str(entity_id)] = label
        return labels


def _sparql(request: DiscoveryRequest) -> str:
    country_values = " ".join(f'"{code}"' for code in request.country_codes)
    fetch_limit = min(request.limit * 4, 200)
    countries = f"VALUES ?countryCode {{ {country_values} }}" if country_values else ""
    employees = (
        "OPTIONAL { ?company wdt:P1128 ?employees. }"
        if request.include_unknown_size else "?company wdt:P1128 ?employees."
    )
    employee_filter = (
        f"!BOUND(?employees) || ?employees >= {request.minimum_employees}"
        if request.include_unknown_size else f"?employees >= {request.minimum_employees}"
    )
    return f"""
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT DISTINCT ?company ?website ?country ?countryCode ?industry ?employees WHERE {{
  ?company wdt:P31/wdt:P279* wd:Q783794;
           wdt:P17 ?country;
           wdt:P856 ?website.
  {employees}
  ?country wdt:P297 ?countryCode.
  {countries}
  OPTIONAL {{ ?company wdt:P452 ?industry. }}
  FILTER({employee_filter})
  FILTER NOT EXISTS {{
    VALUES ?excludedType {{
      wd:Q327333 wd:Q192350 wd:Q732717 wd:Q8473 wd:Q163740 wd:Q708676
    }}
    ?company wdt:P31/wdt:P279* ?excludedType.
  }}
}}
ORDER BY DESC(?employees)
LIMIT {fetch_limit}
""".strip()


def _value(binding: Mapping[str, object], key: str) -> str | None:
    item = binding.get(key)
    if not isinstance(item, dict):
        return None
    value = item.get("value")
    return value if isinstance(value, str) else None


def _entity_id(uri: str | None) -> str | None:
    if uri is None:
        return None
    candidate = uri.rsplit("/", 1)[-1]
    return candidate if candidate.startswith("Q") and candidate[1:].isdigit() else None


def _domain(website: str) -> str | None:
    parsed = urlparse(website)
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return None
    domain = parsed.hostname.lower().rstrip(".")
    return domain[4:] if domain.startswith("www.") else domain


class WikidataDiscovery:
    def __init__(
        self,
        transport: JsonTransport | None = None,
        label_resolver: LabelResolver | None = None,
        timeout: float = 30,
    ) -> None:
        self.transport = transport or UrlLibJsonTransport()
        self.label_resolver = label_resolver or WikidataLabelResolver()
        self.timeout = timeout

    def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
        try:
            payload = self.transport.get_json(
                WIKIDATA_ENDPOINT,
                params={"query": _sparql(request), "format": "json"},
                headers={"Accept": "application/sparql-results+json", "User-Agent": USER_AGENT},
                timeout=self.timeout,
            )
        except WikidataError:
            raise
        except Exception as exc:
            raise WikidataError("Wikidata discovery request failed") from exc

        if not isinstance(payload, dict):
            raise WikidataError("Wikidata returned an invalid response")
        results = payload.get("results")
        bindings = results.get("bindings") if isinstance(results, dict) else None
        if not isinstance(bindings, list):
            raise WikidataError("Wikidata response has no bindings")

        typed = [cast(dict[str, object], item) for item in bindings if isinstance(item, dict)]
        entity_ids = {
            item_id
            for binding in typed
            for item_id in (
                _entity_id(_value(binding, "company")),
                _entity_id(_value(binding, "country")),
                _entity_id(_value(binding, "industry")),
            )
            if item_id is not None
        }
        try:
            labels = self.label_resolver.resolve(entity_ids, timeout=self.timeout)
        except Exception as exc:
            raise WikidataError("Wikidata label lookup failed") from exc

        candidates: list[DiscoveryCandidate] = []
        seen_domains: set[str] = set()
        seen_entities: set[str] = set()
        for binding in typed:
            website = _value(binding, "website")
            entity_url = _value(binding, "company")
            entity_id = _entity_id(entity_url)
            country_code = _value(binding, "countryCode")
            country_id = _entity_id(_value(binding, "country"))
            if not all((website, entity_url, entity_id, country_code, country_id)):
                continue
            assert website and entity_url and entity_id and country_code and country_id
            domain = _domain(website)
            if domain is None or domain in seen_domains or entity_id in seen_entities:
                continue
            name = labels.get(entity_id)
            country_name = labels.get(country_id)
            if name is None or country_name is None:
                continue

            employee_text = _value(binding, "employees")
            try:
                employee_count = int(float(employee_text)) if employee_text is not None else None
            except ValueError:
                employee_count = None
            if employee_count is not None and employee_count > MAX_PLAUSIBLE_EMPLOYEES:
                employee_count = None

            if employee_count is None:
                if not request.include_unknown_size:
                    continue
            elif employee_count < request.minimum_employees:
                continue

            industry = labels.get(_entity_id(_value(binding, "industry")) or "")
            if request.industries and industry and not any(
                term.casefold() in industry.casefold() for term in request.industries
            ):
                continue
            if request.industry and (
                industry is None or request.industry.casefold() not in industry.casefold()
            ):
                continue

            seen_domains.add(domain)
            seen_entities.add(entity_id)
            candidates.append(
                DiscoveryCandidate(
                    entity_id=entity_id,
                    name=name,
                    domain=domain,
                    country_code=country_code,
                    country_name=country_name,
                    industry=industry,
                    employee_count=employee_count,
                    size_verification=SizeVerification.NEEDS_VERIFICATION,
                    discovery_confidence=UNVERIFIED_CONFIDENCE,
                    source_url=entity_url,
                )
            )
            if len(candidates) == request.limit:
                break
        return candidates
