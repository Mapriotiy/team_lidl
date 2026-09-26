from datetime import UTC, datetime

from app.collection import CollectedDocument
from app.contracts.evidence import SourceType
from app.models.research import Company
from app.research.identity import verify_document_identity


def document(text: str, *, source_type: SourceType = SourceType.NEWS) -> CollectedDocument:
    return CollectedDocument(
        id="source-1",
        company_id="company-1",
        canonical_url="https://news.example/article",
        source_type=source_type,
        title="Article",
        retrieved_at=datetime.now(UTC),
        content_hash="hash",
        normalized_text=text,
    )


def company(name: str = "Mercury Logistics") -> Company:
    return Company(
        id="company-1",
        canonical_domain="mercury-logistics.example",
        display_name=name,
        aliases=[],
        facts={"industry": {"value": "Logistics"}, "geography": {"value": "Poland"}},
    )


def test_accepts_first_party_document_without_text_guessing() -> None:
    decision = verify_document_identity(
        company(), document("Welcome", source_type=SourceType.COMPANY)
    )

    assert decision.matched is True


def test_accepts_external_document_with_specific_company_name() -> None:
    decision = verify_document_identity(
        company(), document("Mercury Logistics announced a warehouse automation programme.")
    )

    assert decision.matched is True


def test_rejects_same_word_about_a_different_entity() -> None:
    decision = verify_document_identity(
        company(), document("Scientists published new images of the planet Mercury.")
    )

    assert decision.matched is False


def test_single_word_name_requires_business_or_icp_context() -> None:
    target = company("Orange")
    target.canonical_domain = "orange.example"

    fruit_article = document("Orange prices rose after a poor harvest.")
    telecom_article = document(
        "Telecom operator Orange announced a security programme."
    )

    assert verify_document_identity(target, fruit_article).matched is False
    assert verify_document_identity(target, telecom_article).matched is True
