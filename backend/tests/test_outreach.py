from datetime import UTC, datetime, timedelta

import pytest

from app.models.results import StoredSourceDocument
from app.outreach import DraftChannel, DraftRequest, OutreachEvidence, generate_fallback
from app.outreach.contacts import find_contacts


def test_generates_requested_channel_drafts_from_cited_evidence() -> None:
    evidence = [
        OutreachEvidence(
            id="evidence-1",
            signal_id="automation",
            factual_claim="Example Corp automated invoice processing.",
            excerpt="automated invoice processing",
            source_title="Annual report",
            source_url="https://example.com/report",
        )
    ]

    result = generate_fallback(
        company_id="company-1",
        company_name="Example Corp",
        service_description="We provide process automation services.",
        request=DraftRequest(
            channels=[DraftChannel.EMAIL, DraftChannel.CONNECTION_NOTE],
            recipient_role="Operations leader",
        ),
        evidence=evidence,
    )

    assert [draft.channel for draft in result.drafts] == [
        DraftChannel.EMAIL,
        DraftChannel.CONNECTION_NOTE,
    ]
    assert all(draft.evidence_ids == ["evidence-1"] for draft in result.drafts)
    assert "automated invoice processing" in result.drafts[0].body
    assert "buying intent" not in result.drafts[0].body


def test_prefers_named_company_contact_with_relevant_role() -> None:
    now = datetime.now(UTC)
    document = StoredSourceDocument(
        id="source-1",
        company_id="company-1",
        research_run_id="run-1",
        canonical_url="https://example.ro/contact",
        source_type="company",
        title="Leadership contacts",
        retrieved_at=now,
        publication_date=None,
        event_date=None,
        content_hash="hash",
        normalized_text=(
            "Head of Digital Transformation Ana Popescu ana.popescu@example.ro "
            "General enquiries info@example.ro"
        ),
        text_expires_at=now + timedelta(days=30),
        created_at=now,
    )

    contacts = find_contacts([document], "example.ro")

    assert contacts[0].email == "ana.popescu@example.ro"
    assert contacts[0].name == "Ana Popescu"
    assert contacts[0].role == "Transformation"
    assert contacts[0].confidence == 0.95


@pytest.mark.parametrize(
    ("domain", "company_name", "claims", "subject_phrase", "body_phrase"),
    [
        (
            "pkobp.pl",
            "PKO Bank Polski",
            [
                "The bank's strategy explicitly invests in hyperautomation and process mining.",
                "PKO robots processed nearly 27 million cases in Q1 2025.",
            ],
            "hyperautomation",
            "27 million",
        ),
        (
            "cez.cz",
            "ČEZ Group",
            [
                "ČEZ is building a group-wide platform for process management and automation.",
                "ČEZ uses AI automation to reduce customer-service handling time.",
            ],
            "ČEZ Group",
            "group-wide BPM platform",
        ),
    ],
)
def test_generates_curated_email_for_reference_companies(
    domain: str,
    company_name: str,
    claims: list[str],
    subject_phrase: str,
    body_phrase: str,
) -> None:
    evidence = [
        OutreachEvidence(
            id=f"evidence-{index}",
            signal_id="automation",
            factual_claim=claim,
            excerpt=claim,
            source_title="Official report",
            source_url=f"https://{domain}/report-{index}",
        )
        for index, claim in enumerate(claims)
    ]

    result = generate_fallback(
        company_id="company-1",
        company_name=company_name,
        company_domain=domain,
        service_description="We provide process automation services.",
        request=DraftRequest(channels=[DraftChannel.EMAIL]),
        evidence=evidence,
    )

    draft = result.drafts[0]
    assert subject_phrase in (draft.subject or "")
    assert body_phrase in draft.body
    assert draft.body.count("\n\n") == 2
    assert draft.evidence_ids == ["evidence-0", "evidence-1"]
