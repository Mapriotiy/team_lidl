from app.outreach import DraftChannel, DraftRequest, OutreachEvidence, generate_fallback


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
