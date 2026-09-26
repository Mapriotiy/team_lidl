from datetime import UTC, datetime

from app.collection import CollectedDocument, CollectionResult
from app.contracts.evidence import SourceType
from app.discovery import TenderCall
from app.tender_intelligence import analyze_tender


class EvidenceCollector:
    def collect(self, company, targets):  # type: ignore[no-untyped-def]
        text = (
            "The objective is to deliver an automated public service platform. "
            "Eligible applicants are SMEs established in an EU Member State. "
            "Applications must be submitted by a consortium with a qualified coordinator. "
            "The maximum grant funding is EUR 500,000."
        )
        return CollectionResult(
            documents=(
                CollectedDocument(
                    id="source-1",
                    company_id=company.id,
                    canonical_url=targets[0].url,
                    source_type=SourceType.INDUSTRY,
                    title="Official call",
                    retrieved_at=datetime(2026, 9, 26, tzinfo=UTC),
                    content_hash="hash",
                    normalized_text=text,
                ),
            ),
            errors=(),
            total=1,
        )


def test_analysis_returns_exact_source_excerpts_and_actionable_decision() -> None:
    call = TenderCall(
        identifier="DIGITAL-2026-A",
        title="Automation platform",
        url="https://example.eu/call",
        status="open",
        deadline=datetime(2026, 12, 1, tzinfo=UTC),
        opportunity_type="public_procurement",
    )

    result = analyze_tender(call, EvidenceCollector())  # type: ignore[arg-type]

    assert result.decision == "go_to_bid_review"
    assert result.evidence_coverage == 100
    assert result.confidence >= 80
    assert result.blockers == []
    assert all(fact.excerpt for fact in result.facts)
    assert result.facts[1].excerpt == (
        "Eligible applicants are SMEs established in an EU Member State."
    )


class EmptyCollector:
    def collect(self, company, targets):  # type: ignore[no-untyped-def]
        return CollectionResult(documents=(), errors=(), total=1)


def test_analysis_marks_missing_requirements_instead_of_inventing_them() -> None:
    call = TenderCall(
        identifier="HORIZON-X",
        title="Digital innovation",
        url="https://example.eu/call",
        status="open",
        summary="The objective is to support a digital innovation solution.",
        opportunity_type="funding_call",
    )

    result = analyze_tender(call, EmptyCollector())  # type: ignore[arg-type]

    assert result.decision == "partner_search"
    assert result.confidence < 60
    assert any("Applicant eligibility" in blocker for blocker in result.blockers)
    assert any(fact.status == "not_found" for fact in result.facts)
    assert result.warnings
