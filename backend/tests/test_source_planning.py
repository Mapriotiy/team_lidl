from app.collection.planning import plan_first_party_sources


def test_plans_bounded_first_party_pages_by_research_value() -> None:
    body = b"""
    <a href='/newsroom'>Press and media</a>
    <a href='/careers'>Jobs</a>
    <a href='/investors/annual-report-2025'>Annual report</a>
    <a href='https://linkedin.com/company/example'>LinkedIn</a>
    <a href='https://other.example/news'>Other company</a>
    <a href='/products'>Products</a>
    """
    targets = plan_first_party_sources(body, "https://example.com/", limit=3)
    assert [(item.url, item.source_type.value) for item in targets] == [
        ("https://example.com/investors/annual-report-2025", "report"),
        ("https://example.com/careers", "careers"),
        ("https://example.com/newsroom", "company"),
    ]


def test_planning_deduplicates_fragments_and_respects_limit() -> None:
    body = b"""
    <a href='/news#top'>News</a>
    <a href='/news#latest'>Latest news</a>
    <a href='/careers'>Careers</a>
    """
    targets = plan_first_party_sources(body, "https://example.com/", limit=1)
    assert [item.url for item in targets] == ["https://example.com/careers"]


def test_plans_ukrainian_first_party_links() -> None:
    body = """
    <a href='/novyny'>Новини</a>
    <a href='/vakansii'>Вакансії та робота</a>
    <a href='/reports/2025'>Річна звітність</a>
    """.encode()
    targets = plan_first_party_sources(body, "https://example.ua/", limit=3)
    assert [item.source_type.value for item in targets] == ["report", "careers", "company"]
