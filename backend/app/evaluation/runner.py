import argparse
import hashlib
import json
import os
import subprocess
import time
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast
from urllib.parse import urlparse

from app.assessment import SourceText, validate_assessment
from app.assessment.providers import AssessmentBatch, OpenRouterAssessmentProvider
from app.assessment.validation import AssessmentValidationError
from app.collection import CollectedDocument
from app.contracts.evidence import SourceType
from app.contracts.profile import ProfileConfiguration
from app.evaluation.benchmark import (
    BenchmarkPrediction,
    BenchmarkReport,
    BenchmarkRun,
    CorpusLabel,
    PredictionEvidence,
    ReviewedCorpus,
    evaluate_predictions,
)

FIXTURE_DIR = Path(__file__).parents[1] / "fixtures"
SOURCE_TYPES = {
    "annual_report": SourceType.REPORT,
    "company_newsroom": SourceType.COMPANY,
    "news": SourceType.NEWS,
}


class AssessmentProvider(Protocol):
    model: str

    def assess(
        self,
        *,
        company_id: str,
        company_name: str,
        profile: ProfileConfiguration,
        documents: Sequence[CollectedDocument],
    ) -> AssessmentBatch: ...


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _revision() -> str:
    configured = os.getenv("GIT_REVISION", "").strip()
    if configured:
        return configured
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return "unknown"


def _documents(company_id: str, sources: list[dict[str, Any]]) -> list[CollectedDocument]:
    retrieved_at = datetime.now(UTC)
    documents: list[CollectedDocument] = []
    for source in sources:
        url = str(source["url"])
        title = urlparse(url).path.rstrip("/").rsplit("/", 1)[-1] or urlparse(url).netloc
        published_at = source.get("published_at")
        documents.append(
            CollectedDocument(
                id=str(source["id"]),
                company_id=company_id,
                canonical_url=url,
                source_type=SOURCE_TYPES.get(str(source["source_type"]), SourceType.OTHER),
                title=title.replace("-", " "),
                retrieved_at=retrieved_at,
                publication_date=(
                    datetime.fromisoformat(str(published_at)).replace(tzinfo=UTC)
                    if published_at
                    else None
                ),
                content_hash=hashlib.sha256(
                    str(source["normalized_text"]).encode("utf-8")
                ).hexdigest(),
                normalized_text=str(source["normalized_text"]),
            )
        )
    return documents


def _profiles(path: Path) -> dict[str, ProfileConfiguration]:
    raw = cast(list[dict[str, Any]], _load_json(path))
    return {
        str(item["name"]): ProfileConfiguration.model_validate(item["configuration"])
        for item in raw
    }


def run_benchmark(
    *,
    corpus: ReviewedCorpus,
    profiles: dict[str, ProfileConfiguration],
    provider: AssessmentProvider,
    revision: str,
    budget_usd: float,
    max_calls: int,
) -> tuple[BenchmarkReport, list[BenchmarkPrediction]]:
    started_at = datetime.now(UTC)
    started_clock = time.monotonic()
    predictions: list[BenchmarkPrediction] = []
    attempted = completed = calls = 0
    total_cost = 0.0
    cost_available = True
    notes: list[str] = []

    for company in corpus.companies:
        attempted += 1
        company_complete = True
        documents = _documents(
            company.id, [source.model_dump(mode="json") for source in company.sources]
        )
        source_texts = {
            document.id: SourceText(
                id=document.id,
                company_id=company.id,
                normalized_text=document.normalized_text,
            )
            for document in documents
        }
        labels_by_profile: dict[str, list[CorpusLabel]] = {}
        for label in company.labels:
            labels_by_profile.setdefault(label.profile, []).append(label)

        for profile_name, raw_labels in labels_by_profile.items():
            labels = raw_labels
            if calls >= max_calls or (cost_available and total_cost >= budget_usd):
                company_complete = False
                reason = "benchmark call or cost budget reached"
                predictions.extend(
                    BenchmarkPrediction(
                        company_id=company.id,
                        profile=profile_name,
                        signal_id=label.signal_id,
                        status="invalid",
                        validation_errors=[reason],
                    )
                    for label in labels
                )
                continue
            profile = profiles.get(profile_name)
            if profile is None:
                raise ValueError(f"Corpus references unknown profile: {profile_name}")
            calls += 1
            try:
                batch = provider.assess(
                    company_id=company.id,
                    company_name=company.name,
                    profile=profile,
                    documents=documents,
                )
            except Exception as exc:  # provider failures are benchmark results
                company_complete = False
                predictions.extend(
                    BenchmarkPrediction(
                        company_id=company.id,
                        profile=profile_name,
                        signal_id=label.signal_id,
                        status="invalid",
                        validation_errors=[f"provider failure: {type(exc).__name__}: {exc}"],
                    )
                    for label in labels
                )
                continue
            if batch.cost_usd is None:
                cost_available = False
            else:
                total_cost += batch.cost_usd
            proposals = {item.signal_id: item for item in batch.assessments}
            for label in labels:
                proposal = proposals.get(label.signal_id)
                if proposal is None:
                    company_complete = False
                    predictions.append(
                        BenchmarkPrediction(
                            company_id=company.id,
                            profile=profile_name,
                            signal_id=label.signal_id,
                            status="invalid",
                            validation_errors=["provider omitted the reviewed signal"],
                        )
                    )
                    continue
                try:
                    assessment = validate_assessment(
                        proposal, company_id=company.id, sources=source_texts
                    )
                except AssessmentValidationError as exc:
                    company_complete = False
                    predictions.append(
                        BenchmarkPrediction(
                            company_id=company.id,
                            profile=profile_name,
                            signal_id=label.signal_id,
                            status="invalid",
                            validation_errors=[str(exc)],
                        )
                    )
                    continue
                predictions.append(
                    BenchmarkPrediction(
                        company_id=company.id,
                        profile=profile_name,
                        signal_id=label.signal_id,
                        status=assessment.status,
                        evidence=[
                            PredictionEvidence(
                                source_id=item.source_id,
                                excerpt=item.excerpt,
                                event_group_key=item.event_group_key,
                            )
                            for item in assessment.evidence
                        ],
                    )
                )
        if company_complete:
            completed += 1

    if not cost_available:
        notes.append("Provider cost was unavailable; the monetary budget could not be verified")
    finished_at = datetime.now(UTC)
    run = BenchmarkRun(
        revision=revision,
        started_at=started_at,
        finished_at=finished_at,
        provider_model=provider.model,
        prompt_version="assessment-v2",
        accounts_attempted=attempted,
        accounts_completed=completed,
        latency_ms_total=round((time.monotonic() - started_clock) * 1000),
        provider_cost_usd=total_cost if cost_available else None,
    )
    report = evaluate_predictions(corpus, predictions, run)
    if notes:
        report = report.model_copy(update={"notes": notes})
    return report, predictions


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the reviewed evidence-quality benchmark through the assessment provider."
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--corpus",
        type=Path,
        default=FIXTURE_DIR / "evaluation" / "reviewed_corpus.json",
    )
    parser.add_argument("--profiles", type=Path, default=FIXTURE_DIR / "service_profiles.json")
    parser.add_argument("--revision", default=_revision())
    parser.add_argument("--budget-usd", type=float, default=1.0)
    parser.add_argument("--max-calls", type=int, default=60)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.output.exists() and not args.force:
        parser.error("output already exists; use --force to replace it")
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("ASSESSMENT_MODEL", "").strip()
    if not api_key or not model:
        parser.error("OPENROUTER_API_KEY and ASSESSMENT_MODEL are required")
    if args.budget_usd <= 0 or args.max_calls <= 0:
        parser.error("budget and max-calls must be positive")

    corpus = ReviewedCorpus.model_validate(_load_json(args.corpus))
    provider = OpenRouterAssessmentProvider(
        api_key=api_key,
        model=model,
        timeout=float(os.getenv("ASSESSMENT_TIMEOUT_SECONDS", "90")),
    )
    report, predictions = run_benchmark(
        corpus=corpus,
        profiles=_profiles(args.profiles),
        provider=provider,
        revision=args.revision,
        budget_usd=args.budget_usd,
        max_calls=args.max_calls,
    )
    artifact = {
        **report.model_dump(mode="json"),
        "predictions": [item.model_dump(mode="json") for item in predictions],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n")
    print(f"Benchmark report written to {args.output}")
    print("PASS" if report.passed_quality_gate else "FAIL")
    return 0 if report.passed_quality_gate else 2


if __name__ == "__main__":
    raise SystemExit(main())
