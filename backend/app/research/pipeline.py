from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.assessment import SourceText, validate_assessment
from app.assessment.models import SignalAssessment
from app.assessment.providers import (
    OpenRouterAssessmentProvider,
    OpenRouterTransientError,
)
from app.collection import CanonicalCompany, CollectedDocument, PublicSourceCollector, SourceTarget
from app.contracts.evidence import SourceType
from app.contracts.profile import ProfileConfiguration
from app.contracts.research import PartialError
from app.discovery import GdeltError, GdeltNewsDiscovery
from app.jobs.runner import RetryableResearchError, StageResult
from app.models.profile import ServiceProfileVersion, utc_now
from app.models.research import Company, ResearchRun
from app.models.results import (
    Opportunity,
    StoredEvidence,
    StoredScoreSnapshot,
    StoredSignalAssessment,
    StoredSourceDocument,
)
from app.scoring import IcpCriterion, ScoringInput, SignalScoringInput, calculate_score


def _icp_criteria(company: Company, configuration: ProfileConfiguration) -> list[IcpCriterion]:
    criteria: list[IcpCriterion] = []
    for key, expected in configuration.icp.items():
        if expected in (None, "", []):
            continue
        raw_fact = company.facts.get(key)
        actual = raw_fact.get("value") if isinstance(raw_fact, dict) else raw_fact
        if actual is None:
            matched = None
        elif isinstance(expected, list):
            matched = str(actual).casefold() in {str(value).casefold() for value in expected}
        else:
            matched = str(actual).casefold() == str(expected).casefold()
        criteria.append(IcpCriterion(key=key, matched=matched))
    return criteria


class IntegratedResearchPipeline:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        assessment_provider: OpenRouterAssessmentProvider,
        *,
        collector: PublicSourceCollector | None = None,
        news: GdeltNewsDiscovery | None = None,
        retention_days: int = 30,
        budget_usd: float = 5,
    ) -> None:
        self.sessions = sessions
        self.assessment_provider = assessment_provider
        self.collector = collector or PublicSourceCollector(max_pages=6)
        self.news = news or GdeltNewsDiscovery()
        self.retention_days = retention_days
        self.budget_usd = budget_usd

    def collect(self, run_id: str, company: Company) -> StageResult:
        targets = [SourceTarget(f"https://{company.canonical_domain}/", SourceType.COMPANY)]
        partial_errors: list[PartialError] = []
        try:
            targets.extend(
                candidate.target for candidate in self.news.discover(company.display_name)
            )
        except GdeltError:
            partial_errors.append(
                PartialError(
                    stage="collection",
                    code="news_discovery_failed",
                    message="Recent-news discovery failed; first-party collection continued",
                )
            )
        result = self.collector.collect(
            CanonicalCompany(
                id=company.id,
                canonical_domain=company.canonical_domain,
                aliases=tuple(company.aliases),
            ),
            targets,
        )
        partial_errors.extend(
            PartialError(stage="collection", code=error.code, message=error.message)
            for error in result.errors
        )
        expires_at = utc_now() + timedelta(days=self.retention_days)
        with self.sessions.begin() as session:
            for document in result.documents:
                stored = session.get(StoredSourceDocument, document.id)
                if stored is None:
                    stored = session.scalar(
                        select(StoredSourceDocument).where(
                            StoredSourceDocument.company_id == company.id,
                            StoredSourceDocument.content_hash == document.content_hash,
                        )
                    )
                if stored is None:
                    session.add(
                        StoredSourceDocument(
                            id=document.id,
                            company_id=company.id,
                            research_run_id=run_id,
                            canonical_url=document.canonical_url,
                            source_type=document.source_type,
                            title=document.title,
                            retrieved_at=document.retrieved_at,
                            publication_date=document.publication_date,
                            event_date=document.event_date,
                            content_hash=document.content_hash,
                            normalized_text=document.normalized_text,
                            text_expires_at=expires_at,
                        )
                    )
                else:
                    stored.normalized_text = document.normalized_text
                    stored.text_expires_at = expires_at
        return StageResult(
            data={"documents": [document.model_dump(mode="json") for document in result.documents]},
            completed=len(result.documents),
            total=result.total or len(targets),
            errors=partial_errors,
        )

    def assess(
        self,
        run_id: str,
        company: Company,
        profile: ServiceProfileVersion,
        sources: object,
    ) -> StageResult:
        if not isinstance(sources, dict) or not isinstance(sources.get("documents"), list):
            raise ValueError("Collection checkpoint contains no documents")
        documents = [CollectedDocument.model_validate(item) for item in sources["documents"]]
        if not documents:
            raise ValueError("No collected documents are available for assessment")
        configuration = ProfileConfiguration.model_validate(profile.configuration)
        try:
            batch = self.assessment_provider.assess(
                company_id=company.id,
                company_name=company.display_name,
                profile=configuration,
                documents=documents,
            )
        except OpenRouterTransientError as exc:
            raise RetryableResearchError(
                f"Assessment provider was temporarily unavailable: {exc}"
            ) from exc
        if batch.cost_usd is not None and batch.cost_usd > self.budget_usd:
            raise RuntimeError("Research run exceeded its configured model budget")

        source_texts = {
            document.id: SourceText(
                id=document.id,
                company_id=company.id,
                normalized_text=document.normalized_text,
            )
            for document in documents
        }
        assessments = [
            validate_assessment(proposal, company_id=company.id, sources=source_texts)
            for proposal in batch.assessments
        ]
        documents_by_id = {document.id: document for document in documents}
        signal_inputs: list[SignalScoringInput] = []
        for definition in configuration.signals:
            assessment = next(item for item in assessments if item.signal_id == definition.id)
            cited_documents = [
                documents_by_id[evidence.source_id]
                for evidence in assessment.evidence
                if evidence.source_id in documents_by_id
            ]
            event_dates = [item.event_date for item in cited_documents if item.event_date]
            publication_dates = [
                item.publication_date for item in cited_documents if item.publication_date
            ]
            signal_inputs.append(
                SignalScoringInput(
                    definition=definition,
                    assessment=assessment,
                    event_date=max(event_dates) if event_dates else None,
                    publication_date=max(publication_dates) if publication_dates else None,
                )
            )
        score = calculate_score(
            ScoringInput(
                company_id=company.id,
                profile_version_id=profile.id,
                icp_criteria=_icp_criteria(company, configuration),
                signals=signal_inputs,
                calculated_at=utc_now(),
            )
        )
        with self.sessions.begin() as session:
            evidence_ids = self._persist_assessments(
                session, run_id, company.id, profile.id, assessments
            )
            snapshot = StoredScoreSnapshot(
                research_run_id=run_id,
                company_id=company.id,
                profile_version_id=profile.id,
                calculation_version=score.calculation_version,
                score=score.score,
                eligibility=score.eligibility,
                coverage=score.coverage,
                icp_fit=score.icp_fit,
                positive_strength=score.positive_strength,
                penalty_points=score.penalty_points,
                contributions=[item.model_dump(mode="json") for item in score.contributions],
                exclusion_reasons=score.exclusion_reasons,
                warnings=score.warnings,
            )
            session.add(snapshot)
            session.flush()
            opportunity = session.scalar(
                select(Opportunity).where(
                    Opportunity.company_id == company.id,
                    Opportunity.profile_id == profile.profile_id,
                )
            )
            if opportunity is None:
                opportunity = Opportunity(company_id=company.id, profile_id=profile.profile_id)
                session.add(opportunity)
            opportunity.latest_snapshot_id = snapshot.id
            opportunity.updated_at = utc_now()
            run = session.get(ResearchRun, run_id)
            if run is not None:
                run.usage = {
                    "provider": "openrouter",
                    "model": batch.model,
                    "prompt_tokens": batch.prompt_tokens,
                    "completion_tokens": batch.completion_tokens,
                    "total_tokens": batch.total_tokens,
                    "cost_usd": batch.cost_usd,
                }
        return StageResult(
            data={"score": score.model_dump(mode="json"), "evidence_ids": evidence_ids},
            completed=len(assessments),
            total=len(configuration.signals),
            links={"company": f"/companies/{company.id}"},
        )

    def _persist_assessments(
        self,
        session: Session,
        run_id: str,
        company_id: str,
        profile_version_id: str,
        assessments: list[SignalAssessment],
    ) -> list[str]:
        all_evidence_ids: list[str] = []
        for assessment in assessments:
            evidence_ids: list[str] = []
            for evidence in assessment.evidence:
                stored = session.scalar(
                    select(StoredEvidence).where(
                        StoredEvidence.source_id == evidence.source_id,
                        StoredEvidence.start_offset == evidence.start_offset,
                        StoredEvidence.end_offset == evidence.end_offset,
                        StoredEvidence.event_group_key == evidence.event_group_key,
                    )
                )
                if stored is None:
                    stored = StoredEvidence(**evidence.model_dump())
                    session.add(stored)
                    session.flush()
                evidence_ids.append(stored.id)
            all_evidence_ids.extend(evidence_ids)
            session.add(
                StoredSignalAssessment(
                    research_run_id=run_id,
                    company_id=company_id,
                    profile_version_id=profile_version_id,
                    signal_id=assessment.signal_id,
                    status=assessment.status,
                    evidence_strength=assessment.evidence_strength,
                    evidence_ids=evidence_ids,
                    rationale=assessment.rationale,
                    model_version=assessment.model_version,
                    prompt_version=assessment.prompt_version,
                )
            )
        return all_evidence_ids
