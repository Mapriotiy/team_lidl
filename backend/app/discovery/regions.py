from dataclasses import dataclass


@dataclass(frozen=True)
class DiscoveryRegion:
    id: str
    name: str
    country_codes: tuple[str, ...]


DISCOVERY_REGIONS = (
    DiscoveryRegion(
        "eastern-europe",
        "Eastern Europe",
        (
            "PL", "CZ", "SK", "HU", "RO", "BG", "MD", "UA", "EE", "LV",
            "LT", "SI", "HR", "RS", "BA", "ME", "MK", "AL", "XK",
        ),
    ),
    DiscoveryRegion(
        "western-europe",
        "Western Europe",
        (
            "AT", "BE", "FR", "DE", "IE", "LU", "NL", "CH", "GB", "DK",
            "FI", "IS", "NO", "SE", "ES", "PT", "IT", "GR", "CY", "MT",
        ),
    ),
    DiscoveryRegion("north-america", "North America", ("US", "CA")),
    DiscoveryRegion(
        "asia-pacific",
        "Asia-Pacific",
        ("CN", "JP", "KR", "IN", "SG", "AU", "NZ", "ID", "MY", "TH", "VN", "PH", "HK", "TW"),
    ),
    DiscoveryRegion(
        "latin-america",
        "Latin America",
        ("MX", "BR", "AR", "CL", "CO", "PE", "UY", "EC", "CR", "PA"),
    ),
    DiscoveryRegion(
        "middle-east-africa",
        "Middle East & Africa",
        ("AE", "SA", "QA", "IL", "TR", "ZA", "EG", "MA", "KE", "NG", "GH"),
    ),
)

