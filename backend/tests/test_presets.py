from app.contracts.profile import SignalEffect
from app.seed import load_presets, load_reference_research


def test_three_presets_share_the_versioned_configuration_contract() -> None:
    presets = load_presets()

    assert [preset.name for preset in presets] == [
        "RPA",
        "Cybersecurity",
        "Software development",
    ]


def test_process_automation_covers_annex_positive_and_negative_signals() -> None:
    process_automation = load_presets()[0]
    signal_ids = {signal.id for signal in process_automation.configuration.signals}
    effects = {signal.effect for signal in process_automation.configuration.signals}

    assert {
        "efficiency-program",
        "transformation-initiative",
        "talent-and-leadership",
        "process-consolidation",
        "internal-capability",
        "incumbent-partner",
    } <= signal_ids
    assert {SignalEffect.POSITIVE, SignalEffect.PENALTY} <= effects


def test_reference_research_uses_complete_official_source_sets() -> None:
    companies = load_reference_research()

    assert {company["domain"] for company in companies} == {"pkobp.pl", "cez.cz"}
    for company in companies:
        assert len(company["sources"]) == 5
        assert len(company["assessments"]) == 6
        assert sum(item["status"] == "supported" for item in company["assessments"]) == 4
        assert all(company["domain"] in source["url"] for source in company["sources"])
