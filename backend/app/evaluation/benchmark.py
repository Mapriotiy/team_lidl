from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.assessment.models import AssessmentStatus


class EvaluationModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class CorpusSource(EvaluationModel):
    id: str
    url: str
    source_type: str
    published_at: str | None = None
    language: str
    company_attribution: str
    event_key: str
    normalized_text: str
    syndicated_from: str | None = None
    content_scope: Literal["excerpt_fixture", "full_text", "headline_only"] = (
        "excerpt_fixture"
    )


class CorpusEvidence(EvaluationModel):
    source_id: str
    excerpt: str


class CorpusLabel(EvaluationModel):
    profile: str
    signal_id: str
    expected_status: AssessmentStatus
    expected_effect: str | None = None
    evidence: list[CorpusEvidence] = Field(default_factory=list)
    expected_unique_event_count: int | None = None
    review_note: str | None = None


class CorpusCompany(EvaluationModel):
    id: str
    name: str
    country: str
    domains: list[str]
    aliases: list[str] = Field(default_factory=list)
    case_tags: list[str]
    identity_notes: str | None = None
    sources: list[CorpusSource]
    labels: list[CorpusLabel]


class ReviewedCorpus(EvaluationModel):
    schema_version: int
    review_status: str
    reviewed_at: str
    guidance: str
    companies: list[CorpusCompany]


class PredictionEvidence(EvaluationModel):
    source_id: str
    excerpt: str
    event_group_key: str


class BenchmarkPrediction(EvaluationModel):
    company_id: str
    profile: str
    signal_id: str
    status: AssessmentStatus | Literal["invalid"]
    evidence: list[PredictionEvidence] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)


class BenchmarkRun(EvaluationModel):
    revision: str
    started_at: datetime
    finished_at: datetime
    provider_model: str
    prompt_version: str
    accounts_attempted: int
    accounts_completed: int
    latency_ms_total: int
    provider_cost_usd: float | None


class BenchmarkCounts(EvaluationModel):
    true_positive_supported: int
    false_positive_supported: int
    false_negative_supported: int
    supported_predictions: int
    reviewed_labels: int
    labels_with_usable_sources: int
    wrong_company_attributions: int
    inaccurate_excerpts: int
    duplicate_events_counted: int
    headline_only_supported: int


class BenchmarkMetrics(EvaluationModel):
    supported_finding_precision: float | None
    missed_signal_rate: float | None
    research_coverage: float | None
    wrong_company_attribution_rate: float | None
    excerpt_accuracy: float | None
    headline_only_supported_rate: float | None
    mean_latency_ms_per_completed_account: float | None
    mean_cost_usd_per_completed_account: float | None


class BenchmarkReport(EvaluationModel):
    schema_version: int = 2
    corpus_version: str
    run: BenchmarkRun
    counts: BenchmarkCounts
    metrics: BenchmarkMetrics
    passed_quality_gate: bool
    gate_failures: list[str]
    notes: list[str] = Field(default_factory=list)


def _ratio(numerator: int | float, denominator: int | float) -> float | None:
    return numerator / denominator if denominator else None


def _evidence_matches_expected(
    predicted: list[PredictionEvidence], expected: list[CorpusEvidence]
) -> bool:
    if not expected:
        return False
    return any(
        item.source_id == reference.source_id
        and (item.excerpt in reference.excerpt or reference.excerpt in item.excerpt)
        for item in predicted
        for reference in expected
    )


def evaluate_predictions(
    corpus: ReviewedCorpus,
    predictions: list[BenchmarkPrediction],
    run: BenchmarkRun,
) -> BenchmarkReport:
    """Score final validated outputs; never interpret model confidence as probability."""
    prediction_map = {
        (item.company_id, item.profile, item.signal_id): item for item in predictions
    }
    true_positive = false_positive = false_negative = 0
    supported_predictions = 0
    usable_labels = 0
    wrong_company = inaccurate_excerpts = duplicate_events = headline_only = 0

    for company in corpus.companies:
        sources = {source.id: source for source in company.sources}
        if sources:
            usable_labels += len(company.labels)
        for label in company.labels:
            prediction = prediction_map.get((company.id, label.profile, label.signal_id))
            predicted_supported = (
                prediction is not None and prediction.status == AssessmentStatus.SUPPORTED
            )
            if predicted_supported and prediction is not None:
                supported_predictions += 1
                source_events: list[str] = []
                evidence_sources: list[CorpusSource] = []
                for evidence in prediction.evidence:
                    source = sources.get(evidence.source_id)
                    if source is None or source.company_attribution != "confirmed":
                        wrong_company += 1
                        continue
                    evidence_sources.append(source)
                    source_events.append(source.event_key)
                    if evidence.excerpt not in source.normalized_text:
                        inaccurate_excerpts += 1
                duplicate_events += len(source_events) - len(set(source_events))
                if evidence_sources and all(
                    source.content_scope == "headline_only" for source in evidence_sources
                ):
                    headline_only += 1

            evidence_correct = bool(
                predicted_supported
                and prediction is not None
                and _evidence_matches_expected(prediction.evidence, label.evidence)
            )
            expected_supported = label.expected_status == AssessmentStatus.SUPPORTED
            if expected_supported and evidence_correct:
                true_positive += 1
            elif predicted_supported:
                false_positive += 1
            if expected_supported and not evidence_correct:
                false_negative += 1

    reviewed_labels = sum(len(company.labels) for company in corpus.companies)
    precision = _ratio(true_positive, true_positive + false_positive)
    missed_rate = _ratio(false_negative, true_positive + false_negative)
    failures: list[str] = []
    if not run.revision.strip() or run.revision == "unknown":
        failures.append("Exact application revision is required for a reproducible benchmark")
    if len(prediction_map) != reviewed_labels:
        failures.append(
            f"Expected {reviewed_labels} predictions, received {len(prediction_map)}"
        )
    if precision is None or precision < 0.9:
        failures.append("Supported-finding precision is below 90% or unavailable")
    if wrong_company:
        failures.append("At least one supported finding cites another or unknown company")
    if inaccurate_excerpts:
        failures.append("At least one supported finding has an inaccurate excerpt")
    if duplicate_events:
        failures.append("At least one duplicate event survived validation")
    if headline_only:
        failures.append("At least one supported finding relies only on headline text")

    counts = BenchmarkCounts(
        true_positive_supported=true_positive,
        false_positive_supported=false_positive,
        false_negative_supported=false_negative,
        supported_predictions=supported_predictions,
        reviewed_labels=reviewed_labels,
        labels_with_usable_sources=usable_labels,
        wrong_company_attributions=wrong_company,
        inaccurate_excerpts=inaccurate_excerpts,
        duplicate_events_counted=duplicate_events,
        headline_only_supported=headline_only,
    )
    return BenchmarkReport(
        corpus_version=corpus.review_status,
        run=run,
        counts=counts,
        metrics=BenchmarkMetrics(
            supported_finding_precision=precision,
            missed_signal_rate=missed_rate,
            research_coverage=_ratio(usable_labels, reviewed_labels),
            wrong_company_attribution_rate=_ratio(wrong_company, reviewed_labels),
            excerpt_accuracy=(
                1 - inaccurate_excerpts / reviewed_labels if reviewed_labels else None
            ),
            headline_only_supported_rate=_ratio(headline_only, supported_predictions),
            mean_latency_ms_per_completed_account=_ratio(
                run.latency_ms_total, run.accounts_completed
            ),
            mean_cost_usd_per_completed_account=(
                _ratio(run.provider_cost_usd, run.accounts_completed)
                if run.provider_cost_usd is not None
                else None
            ),
        ),
        passed_quality_gate=not failures,
        gate_failures=failures,
    )
