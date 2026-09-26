import re
from dataclasses import dataclass

from app.models.results import StoredSourceDocument

EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])([\w.+-]+@[a-z0-9.-]+\.[a-z]{2,})(?![\w.-])", re.I
)
GENERIC_LOCALS = {
    "contact", "office", "info", "hello", "sales", "business", "support", "media",
    "press", "careers", "jobs", "privacy", "investor", "relations", "reception",
}
ROLE_TERMS = (
    "automation", "operations", "operational", "transformation", "digital", "innovation",
    "process", "technology", "procurement", "chief", "director", "head", "manager", "lead",
)


@dataclass(frozen=True)
class ContactMatch:
    email: str
    name: str | None
    role: str | None
    source_url: str
    source_title: str
    confidence: float


def _name_from_local(local: str) -> str | None:
    parts = [value for value in re.split(r"[._-]+", re.sub(r"\d+$", "", local)) if value]
    if len(parts) not in {2, 3} or any(part in GENERIC_LOCALS for part in parts):
        return None
    if any(len(part) < 2 for part in parts):
        return None
    return " ".join(part.capitalize() for part in parts)


def find_contacts(documents: list[StoredSourceDocument], company_domain: str) -> list[ContactMatch]:
    matches: dict[str, ContactMatch] = {}
    domain = company_domain.casefold().removeprefix("www.")
    for document in documents:
        text = document.normalized_text or ""
        for occurrence in EMAIL_PATTERN.finditer(text):
            email = occurrence.group(1).strip(".,;:()[]<>").casefold()
            local, email_domain = email.rsplit("@", 1)
            if email_domain.endswith(("example.com", "example.org", "sentry.io")):
                continue
            name = _name_from_local(local)
            context = text[max(0, occurrence.start() - 180): occurrence.end() + 180]
            role = next((term.title() for term in ROLE_TERMS if term in context.casefold()), None)
            company_address = email_domain == domain or email_domain.endswith("." + domain)
            generic = local.split("+")[0] in GENERIC_LOCALS
            score = 0.45 + (0.25 if company_address else 0) + (0.15 if name else 0)
            score += 0.1 if role else 0
            score -= 0.08 if generic else 0
            candidate = ContactMatch(
                email=email,
                name=name,
                role=role,
                source_url=document.canonical_url,
                source_title=document.title or "Company website",
                confidence=max(0.0, min(0.95, score)),
            )
            current = matches.get(email)
            if current is None or candidate.confidence > current.confidence:
                matches[email] = candidate
    return sorted(
        matches.values(),
        key=lambda item: (
            item.role is not None,
            item.name is not None,
            item.confidence,
        ),
        reverse=True,
    )
