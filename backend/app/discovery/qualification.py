from app.discovery.models import (
    DiscoveryCandidate,
    DiscoveryRequest,
    QualificationStatus,
)


def _matches_industry(actual: str, expected: list[str]) -> bool:
    candidate = " ".join(actual.casefold().split())
    return any(
        target.casefold().strip() in candidate or candidate in target.casefold().strip()
        for target in expected
        if target.strip()
    )


def qualify_candidate(
    candidate: DiscoveryCandidate, request: DiscoveryRequest
) -> DiscoveryCandidate:
    """Classify deterministic ICP facts before paid research.

    Unknown facts remain reviewable. A known mismatch is retained for transparency but cannot
    be confirmed for research through the discovery endpoint.
    """
    matches: list[str] = []
    unknowns: list[str] = []
    mismatches: list[str] = []

    if request.country_codes:
        if candidate.country_code in request.country_codes:
            matches.append("Target geography matches")
        else:
            mismatches.append("Country is outside the target geography")

    expected_industries = list(request.industries)
    if request.industry:
        expected_industries.append(request.industry)
    if expected_industries:
        if candidate.industry is None:
            unknowns.append("Industry needs verification")
        elif _matches_industry(candidate.industry, expected_industries):
            matches.append("Target industry matches")
        else:
            mismatches.append("Industry is outside the target profile")

    if request.minimum_employees > 1:
        if candidate.employee_count is None:
            unknowns.append("Company size needs verification")
        elif candidate.employee_count < request.minimum_employees:
            mismatches.append(
                f"Reported size is below {request.minimum_employees:,} employees"
            )
        else:
            matches.append("Reported size meets the target minimum")

    if mismatches:
        status = QualificationStatus.OUT_OF_ICP
        reasons = mismatches + unknowns + matches
    elif unknowns:
        status = QualificationStatus.NEEDS_VERIFICATION
        reasons = unknowns + matches
    else:
        status = QualificationStatus.QUALIFIED
        reasons = matches or ["No restrictive ICP fact is contradicted"]
    return candidate.model_copy(
        update={"qualification": status, "qualification_reasons": reasons}
    )


def qualify_candidates(
    candidates: list[DiscoveryCandidate], request: DiscoveryRequest
) -> list[DiscoveryCandidate]:
    return [qualify_candidate(candidate, request) for candidate in candidates]
