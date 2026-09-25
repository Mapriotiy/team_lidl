import json
from collections.abc import Mapping
from typing import Protocol, cast
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from app.discovery.models import DiscoveryCandidate, DiscoveryRequest, SizeVerification

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"


class WikidataError(RuntimeError):
    pass


class JsonTransport(Protocol):
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object: ...


class UrlLibJsonTransport:
    def get_json(
        self, url: str, *, params: Mapping[str, str], headers: Mapping[str, str], timeout: float
    ) -> object:
        request = Request(f"{url}?{urlencode(params)}", headers=dict(headers))
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS endpoint
            if response.status != 200:
                raise WikidataError(f"Wikidata returned HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))


def _sparql(request: DiscoveryRequest) -> str:
    country_values = " ".join(f'"{code}"' for code in request.country_codes)
    unknown_filter = " || !BOUND(?employees)" if request.include_unknown_size else ""
    fetch_limit = min(request.limit * 4, 200)
    return f"""
SELECT DISTINCT ?company ?companyLabel ?website ?countryCode ?countryLabel
                ?industryLabel ?employees WHERE {{
  ?company wdt:P31/wdt:P279* wd:Q783794;
           wdt:P17 ?country;
           wdt:P856 ?website.
  ?country wdt:P297 ?countryCode.
  VALUES ?countryCode {{ {country_values} }}
  OPTIONAL {{ ?company wdt:P452 ?industry. }}
  OPTIONAL {{ ?company wdt:P1128 ?employees. }}
  FILTER(?employees >= {request.minimum_employees}{unknown_filter})
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
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


def _domain(website: str) -> str | None:
    parsed = urlparse(website)
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return None
    domain = parsed.hostname.lower().rstrip(".")
    return domain[4:] if domain.startswith("www.") else domain


class WikidataDiscovery:
    def __init__(self, transport: JsonTransport | None = None, timeout: float = 20) -> None:
        self.transport = transport or UrlLibJsonTransport()
        self.timeout = timeout

    def discover(self, request: DiscoveryRequest) -> list[DiscoveryCandidate]:
        try:
            payload = self.transport.get_json(
                WIKIDATA_ENDPOINT,
                params={"query": _sparql(request), "format": "json"},
                headers={
                    "Accept": "application/sparql-results+json",
                    "User-Agent": "TeamLIDLResearch/0.1 (public company discovery)",
                },
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

        candidates: list[DiscoveryCandidate] = []
        seen_domains: set[str] = set()
        for raw in bindings:
            if not isinstance(raw, dict):
                continue
            binding = cast(dict[str, object], raw)
            website = _value(binding, "website")
            entity_url = _value(binding, "company")
            name = _value(binding, "companyLabel")
            country_code = _value(binding, "countryCode")
            country_name = _value(binding, "countryLabel")
            if not all((website, entity_url, name, country_code, country_name)):
                continue
            assert website is not None and entity_url is not None
            assert name is not None and country_code is not None and country_name is not None
            domain = _domain(website)
            if domain is None or domain in seen_domains:
                continue

            employee_text = _value(binding, "employees")
            try:
                employee_count = int(float(employee_text)) if employee_text is not None else None
            except ValueError:
                employee_count = None
            if employee_count is not None and employee_count < request.minimum_employees:
                continue
            if employee_count is None and not request.include_unknown_size:
                continue

            industry = _value(binding, "industryLabel")
            if request.industry and (
                industry is None or request.industry.casefold() not in industry.casefold()
            ):
                continue

            seen_domains.add(domain)
            verified = employee_count is not None
            candidates.append(
                DiscoveryCandidate(
                    entity_id=entity_url.rsplit("/", 1)[-1],
                    name=name,
                    domain=domain,
                    country_code=country_code,
                    country_name=country_name,
                    industry=industry,
                    employee_count=employee_count,
                    size_verification=(
                        SizeVerification.VERIFIED
                        if verified
                        else SizeVerification.NEEDS_VERIFICATION
                    ),
                    discovery_confidence=0.9 if verified else 0.55,
                    source_url=entity_url,
                )
            )
            if len(candidates) == request.limit:
                break
        return candidates
