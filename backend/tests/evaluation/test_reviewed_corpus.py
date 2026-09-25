import json
from collections import Counter
from pathlib import Path
from typing import Any, cast

FIXTURE_DIR = Path(__file__).parents[2] / "app" / "fixtures" / "evaluation"
PROFILE_SIGNALS = {
    "Process automation": {
        "efficiency-program",
        "transformation-initiative",
        "talent-and-leadership",
        "process-consolidation",
        "internal-capability",
        "incumbent-partner",
    },
    "Cybersecurity": {
        "security-hiring",
        "compliance-initiative",
        "cloud-migration",
        "confirmed-incident",
    },
    "Software development": {
        "product-launch",
        "platform-modernization",
        "digital-expansion",
        "engineering-hiring",
    },
}
REQUIRED_CASE_TAGS = {
    "strong-match",
    "weak-match",
    "sparse-sources",
    "disqualifier",
    "ambiguous-name",
    "stale-evidence",
    "syndicated-coverage",
    "multi-service",
}


def load_json(name: str) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8")))


def test_corpus_has_required_size_profiles_and_edge_cases() -> None:
    corpus = load_json("reviewed_corpus.json")
    companies = corpus["companies"]
    labels = [label for company in companies for label in company["labels"]]

    assert 15 <= len(companies) <= 25
    assert 60 <= len(labels) <= 100
    assert {label["profile"] for label in labels} == set(PROFILE_SIGNALS)
    assert REQUIRED_CASE_TAGS <= {
        tag for company in companies for tag in company["case_tags"]
    }
    assert any(len({label["profile"] for label in company["labels"]}) > 1 for company in companies)


def test_labels_use_real_profile_signal_ids_and_valid_statuses() -> None:
    corpus = load_json("reviewed_corpus.json")
    company_ids = [company["id"] for company in corpus["companies"]]
    assert len(company_ids) == len(set(company_ids))

    for company in corpus["companies"]:
        assert company["name"].strip()
        assert company["country"].strip()
        assert company["domains"]
        for label in company["labels"]:
            assert label["signal_id"] in PROFILE_SIGNALS[label["profile"]]
            assert label["expected_status"] in {
                "supported",
                "contradicted",
                "insufficient_evidence",
            }
            if label["expected_status"] == "insufficient_evidence":
                assert label["evidence"] == []
            else:
                assert label["evidence"]


def test_evidence_is_exact_and_attributed_to_the_company_fixture() -> None:
    corpus = load_json("reviewed_corpus.json")

    for company in corpus["companies"]:
        sources = {source["id"]: source for source in company["sources"]}
        assert len(sources) == len(company["sources"])
        for source in sources.values():
            assert source["company_attribution"] == "confirmed"
            assert source["url"].startswith("https://")
            assert source["normalized_text"].strip()
        for label in company["labels"]:
            for evidence in label["evidence"]:
                source = sources[evidence["source_id"]]
                assert evidence["excerpt"] in source["normalized_text"]


def test_syndicated_sources_share_event_keys_and_are_not_duplicate_labels() -> None:
    corpus = load_json("reviewed_corpus.json")
    syndicated_cases = [
        company for company in corpus["companies"] if "syndicated-coverage" in company["case_tags"]
    ]
    assert syndicated_cases

    for company in syndicated_cases:
        event_counts = Counter(source["event_key"] for source in company["sources"])
        assert any(count > 1 for count in event_counts.values())
        dedup_labels = [
            label for label in company["labels"] if "expected_unique_event_count" in label
        ]
        assert dedup_labels
        assert all(label["expected_unique_event_count"] == 1 for label in dedup_labels)


def test_evaluation_run_template_covers_required_quality_and_cost_metrics() -> None:
    report = load_json("evaluation_run_template.json")

    assert report["corpus_version"] == load_json("reviewed_corpus.json")["review_status"]
    assert set(report["counts"]) == {
        "true_positive_supported",
        "false_positive_supported",
        "false_negative_supported",
        "reviewed_labels",
        "labels_with_usable_sources",
        "wrong_company_attributions",
        "inaccurate_excerpts",
        "duplicate_events_counted",
    }
    assert set(report["metrics"]) == {
        "supported_finding_precision",
        "missed_signal_rate",
        "research_coverage",
        "wrong_company_attribution_rate",
        "excerpt_accuracy",
        "mean_latency_ms_per_completed_account",
        "mean_cost_usd_per_completed_account",
    }
    assert all(value is None for value in report["metrics"].values())


def test_metric_definitions_are_reproducible() -> None:
    counts = {
        "true_positive_supported": 18,
        "false_positive_supported": 2,
        "false_negative_supported": 5,
        "reviewed_labels": 64,
        "labels_with_usable_sources": 48,
        "wrong_company_attributions": 1,
        "inaccurate_excerpts": 2,
    }
    completed_accounts = 16
    latency_ms_total = 80_000
    provider_cost_usd = 1.6

    assert counts["true_positive_supported"] / (
        counts["true_positive_supported"] + counts["false_positive_supported"]
    ) == 0.9
    assert counts["false_negative_supported"] / (
        counts["true_positive_supported"] + counts["false_negative_supported"]
    ) == 5 / 23
    assert counts["labels_with_usable_sources"] / counts["reviewed_labels"] == 0.75
    assert counts["wrong_company_attributions"] / counts["reviewed_labels"] == 1 / 64
    assert 1 - counts["inaccurate_excerpts"] / counts["reviewed_labels"] == 62 / 64
    assert latency_ms_total / completed_accounts == 5_000
    assert provider_cost_usd / completed_accounts == 0.1
