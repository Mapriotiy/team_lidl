from app.contracts.profile import SignalEffect
from app.seed import load_presets


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
