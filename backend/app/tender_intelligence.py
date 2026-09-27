"""Evidence-backed first-pass intelligence for one public EU opportunity."""

import re
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, Field

from app.collection import CanonicalCompany, PublicSourceCollector, SourceTarget
from app.contracts.evidence import SourceType
from app.discovery import TenderCall

FactCategory = Literal["scope", "eligibility", "consortium", "funding", "deadline"]


class TenderFact(BaseModel):
    category: FactCategory
    label: str
    status: Literal["supported", "not_found"]
    finding: str
    excerpt: str | None = None
    source_url: str


class TenderIntelligence(BaseModel):
    decision: Literal["go_to_bid_review", "partner_search", "needs_review", "insufficient_evidence"]
    confidence: int = Field(ge=0, le=100)
    evidence_coverage: int = Field(ge=0, le=100)
    facts: list[TenderFact]
    blockers: list[str]
    next_actions: list[str]
    source_url: str
    retrieved_at: datetime
    warnings: list[str] = Field(default_factory=list)


_FACTS: tuple[tuple[FactCategory, str, tuple[str, ...]], ...] = (
    (
        "scope",
        "Scope and deliverables",
        ("objective", "deliverable", "solution", "scope", "services"),
    ),
    (
        "eligibility",
        "Applicant eligibility",
        ("eligible", "eligibility", "who can apply", "applicant", "sme"),
    ),
    (
        "consortium",
        "Consortium requirements",
        ("consortium", "partner", "coordinator", "beneficiary"),
    ),
    (
        "funding",
        "Funding and co-financing",
        ("€", "eur", "grant", "budget", "co-financ", "funding"),
    ),
)


def _excerpt(text: str, keywords: tuple[str, ...]) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+|\s*[\n\r]+\s*", text)
    for keyword in keywords:
        for sentence in sentences:
            clean = " ".join(sentence.split())
            lowered = clean.casefold()
            position = lowered.find(keyword)
            if len(clean) < 35 or position < 0:
                continue
            if len(clean) <= 500:
                return clean
            start = max(0, position - 140)
            end = min(len(clean), position + len(keyword) + 260)
            if start:
                start = clean.find(" ", start) + 1
            if end < len(clean):
                end = clean.rfind(" ", 0, end)
            excerpt = clean[start:end].strip(" ,;:-")
            return excerpt if len(excerpt) >= 35 else None
    return None


def analyze_tender(call: TenderCall, collector: PublicSourceCollector) -> TenderIntelligence:
    host = urlsplit(call.url).hostname or "ec.europa.eu"
    result = collector.collect(
        CanonicalCompany(id=f"tender:{call.identifier}", canonical_domain=host),
        [SourceTarget(call.url, SourceType.INDUSTRY)],
    )
    live_text = result.documents[0].normalized_text if result.documents else ""
    # Search metadata is itself public portal evidence and remains useful when a JS page
    # or external call site cannot be collected. Never present it as full documentation.
    text = " ".join(value for value in (live_text, call.summary) if value).strip()
    warnings: list[str] = []
    if not live_text:
        warnings.append(
            "The source page could not be collected; analysis uses portal metadata only."
        )
    facts: list[TenderFact] = []
    for category, label, keywords in _FACTS:
        excerpt = _excerpt(text, keywords)
        if category == "eligibility" and excerpt:
            eligibility_context = (
                "eligible applicant",
                "can apply",
                "open to",
                "must be",
                "sme",
                "small and medium",
                "organisation",
                "individual",
            )
            if not any(value in excerpt.casefold() for value in eligibility_context):
                excerpt = None
        facts.append(
            TenderFact(
                category=category,
                label=label,
                status="supported" if excerpt else "not_found",
                finding=(
                    "Relevant language was found in the collected public source."
                    if excerpt
                    else "No explicit statement was found in the collected text."
                ),
                excerpt=excerpt,
                source_url=call.url,
            )
        )
    deadline_excerpt = call.deadline.isoformat() if call.deadline else None
    facts.append(
        TenderFact(
            category="deadline",
            label="Submission deadline",
            status="supported" if deadline_excerpt else "not_found",
            finding=(
                f"Published deadline: {deadline_excerpt}."
                if deadline_excerpt
                else "No structured deadline was supplied by the portal."
            ),
            excerpt=deadline_excerpt,
            source_url=call.url,
        )
    )
    supported = {fact.category for fact in facts if fact.status == "supported"}
    coverage = round(100 * len(supported) / len(facts))
    confidence = min(95, 25 + 12 * len(supported) + (10 if live_text else 0))
    blockers = [
        f"{fact.label} is not evidenced in the collected text."
        for fact in facts
        if fact.status == "not_found" and fact.category in {"eligibility", "consortium"}
    ]
    if not text:
        decision = "insufficient_evidence"
    elif call.opportunity_type in {"funding_call", "cascade_funding"}:
        decision = "partner_search" if "scope" in supported else "insufficient_evidence"
    elif "eligibility" in supported and "scope" in supported:
        decision = "go_to_bid_review"
    else:
        decision = "needs_review"
    next_actions = [
        "Verify every missing requirement in the complete call documents.",
        "Confirm delivery capacity against the published scope and deadline.",
    ]
    if decision == "partner_search":
        next_actions.insert(0, "Identify a qualified coordinator or consortium partner.")
    elif decision == "go_to_bid_review":
        next_actions.insert(0, "Start a formal commercial and legal bid review.")
    return TenderIntelligence(
        decision=decision,
        confidence=confidence,
        evidence_coverage=coverage,
        facts=facts,
        blockers=blockers,
        next_actions=next_actions,
        source_url=call.url,
        retrieved_at=datetime.now(UTC),
        warnings=warnings,
    )
