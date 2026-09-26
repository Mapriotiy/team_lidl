import re
import unicodedata
from dataclasses import dataclass

from app.collection import CollectedDocument
from app.contracts.evidence import SourceType
from app.models.research import Company

_FIRST_PARTY_TYPES = {SourceType.COMPANY, SourceType.CAREERS, SourceType.REPORT}
_CORPORATE_ANCHORS = {
    "airline",
    "bank",
    "business",
    "company",
    "corporation",
    "firm",
    "group",
    "inc",
    "ltd",
    "manufacturer",
    "operator",
    "plc",
    "retailer",
    "telecom",
}
_DOMAIN_NOISE = {"co", "com", "eu", "global", "group", "net", "org", "uk", "www"}


@dataclass(frozen=True)
class IdentityDecision:
    matched: bool
    reason: str


def _normalize(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return " ".join(re.findall(r"[a-z0-9]+", ascii_text.casefold()))


def _contains(text: str, phrase: str) -> bool:
    return bool(phrase) and f" {phrase} " in f" {text} "


def _fact_tokens(company: Company) -> set[str]:
    tokens: set[str] = set()
    for key in ("industry", "geography"):
        raw = company.facts.get(key)
        value = raw.get("value") if isinstance(raw, dict) else raw
        if value is not None:
            tokens.update(token for token in _normalize(str(value)).split() if len(token) >= 4)
    return tokens


def _domain_brands(domain: str) -> set[str]:
    labels = _normalize(domain.replace(".", " ").replace("-", " ")).split()
    meaningful = [label for label in labels if len(label) >= 3 and label not in _DOMAIN_NOISE]
    return {" ".join(meaningful)} if meaningful else set()


def verify_document_identity(
    company: Company, document: CollectedDocument
) -> IdentityDecision:
    """Require semantic company attribution for sources outside verified company domains."""
    if document.source_type in _FIRST_PARTY_TYPES:
        return IdentityDecision(True, "First-party domain was verified during collection")

    text = _normalize(f"{document.title} {document.normalized_text[:20_000]}")
    names = {
        normalized
        for value in (company.display_name, *company.aliases)
        if (normalized := _normalize(value))
    }
    specific_names = {name for name in names if len(name.split()) >= 2}
    if any(_contains(text, name) for name in specific_names):
        return IdentityDecision(True, "Canonical company name or alias occurs in the source")

    domain_brands = _domain_brands(company.canonical_domain)
    specific_domain_brands = {brand for brand in domain_brands if len(brand.split()) >= 2}
    if any(_contains(text, brand) for brand in specific_domain_brands):
        return IdentityDecision(True, "Canonical domain brand occurs in the source")

    single_names = {
        name
        for name in names | domain_brands
        if len(name.split()) == 1 and len(name) >= 4
    }
    mentioned = next((name for name in single_names if _contains(text, name)), None)
    anchors = _CORPORATE_ANCHORS | _fact_tokens(company)
    if mentioned is not None and any(_contains(text, anchor) for anchor in anchors):
        return IdentityDecision(True, "Company name occurs with corporate or ICP context")

    return IdentityDecision(
        False,
        "No canonical company name, alias, domain brand, or contextual identity match",
    )
