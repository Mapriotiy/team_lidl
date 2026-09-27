from app.discovery import (
    DiscoveryCandidate,
    DiscoveryRequest,
    QualificationStatus,
    SizeVerification,
    qualify_candidate,
)


def candidate(
    *, industry: str | None = "Logistics", employees: int | None = 2500
) -> DiscoveryCandidate:
    return DiscoveryCandidate(
        entity_id="Q1",
        name="Example Logistics",
        domain="example.com",
        country_code="PL",
        country_name="Poland",
        industry=industry,
        employee_count=employees,
        size_verification=SizeVerification.NEEDS_VERIFICATION,
        discovery_confidence=0.55,
        source_url="https://www.wikidata.org/entity/Q1",
    )


def test_qualifies_known_matching_icp_facts() -> None:
    result = qualify_candidate(
        candidate(),
        DiscoveryRequest(country_codes=["PL"], industries=["Logistics"]),
    )

    assert result.qualification == QualificationStatus.QUALIFIED
    assert result.qualification_reasons == [
        "Target geography matches",
        "Target industry matches",
        "Reported size meets the target minimum",
    ]


def test_keeps_unknown_facts_for_verification() -> None:
    result = qualify_candidate(
        candidate(industry=None, employees=None),
        DiscoveryRequest(country_codes=["PL"], industries=["Logistics"]),
    )

    assert result.qualification == QualificationStatus.NEEDS_VERIFICATION
    assert result.qualification_reasons[:2] == [
        "Industry needs verification",
        "Company size needs verification",
    ]


def test_marks_known_mismatch_out_of_icp() -> None:
    result = qualify_candidate(
        candidate(),
        DiscoveryRequest(country_codes=["PL"], industries=["Financial services"]),
    )

    assert result.qualification == QualificationStatus.OUT_OF_ICP
    assert result.qualification_reasons[0] == "Industry is outside the target profile"
