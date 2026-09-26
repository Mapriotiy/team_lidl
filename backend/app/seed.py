import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from importlib.resources import files
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app.contracts.profile import ProfileCreate
from app.db import SessionLocal
from app.models.profile import ServiceProfile, ServiceProfileVersion
from app.models.research import Company, ResearchRun
from app.models.results import (
    EvidenceTranslation,
    StoredEvidence,
    StoredScoreSnapshot,
    StoredSignalAssessment,
    StoredSourceDocument,
)

DEFAULT_PROFILE_NAME = "RPA"
LEGACY_DEFAULT_PROFILE_NAME = "Process automation"


def load_presets() -> list[ProfileCreate]:
    fixture = files("app.fixtures").joinpath("service_profiles.json").read_text(encoding="utf-8")
    return [ProfileCreate.model_validate(item) for item in json.loads(fixture)]


def load_reference_research() -> list[dict[str, Any]]:
    fixture = files("app.fixtures").joinpath("reference_research.json").read_text(
        encoding="utf-8"
    )
    return list(json.loads(fixture))


def stable_id(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://leadradar.local/{value}"))


def parsed_date(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value).replace(tzinfo=UTC) if value else None


def seed_reference_research() -> None:
    now = datetime.now(UTC)
    with SessionLocal.begin() as session:
        profile_version = session.scalar(
            select(ServiceProfileVersion)
            .join(ServiceProfile)
            .where(ServiceProfile.name == DEFAULT_PROFILE_NAME)
            .order_by(ServiceProfileVersion.version.desc())
        )
        if profile_version is None:
            return
        for entry in load_reference_research():
            domain = str(entry["domain"])
            run_key = f"reference-research-v1-{domain}"
            if session.scalar(select(ResearchRun).where(ResearchRun.idempotency_key == run_key)):
                continue
            company = session.scalar(select(Company).where(Company.canonical_domain == domain))
            if company is None:
                company = Company(canonical_domain=domain, display_name=str(entry["name"]))
                session.add(company)
                session.flush()
            company.display_name = str(entry["name"])
            company.aliases = list(entry["aliases"])
            run_id = stable_id(f"run/{domain}")
            source_ids = {
                str(source["key"]): stable_id(f"source/{domain}/{source['key']}")
                for source in entry["sources"]
            }
            company.facts = {
                key: {
                    **value,
                    "source_ids": [source_ids[source_key] for source_key in value["source_ids"]],
                }
                for key, value in entry["facts"].items()
            }
            company.updated_at = now
            run = ResearchRun(
                id=run_id,
                company_id=company.id,
                profile_version_id=profile_version.id,
                idempotency_key=run_key,
                status="completed",
                progress=[
                    {"stage": "collection", "completed": 5, "total": 5},
                    {"stage": "assessment", "completed": 6, "total": 6},
                ],
                partial_errors=[],
                result_links={"company": f"/companies/{company.id}"},
                stage_results={"collection": "completed", "assessment": "completed"},
                usage={"model": "verified-public-sources", "total_tokens": 0, "cost_usd": 0.0},
                attempts=1,
                max_attempts=3,
                available_at=now,
                queued_at=now,
                started_at=now,
                finished_at=now,
            )
            session.add(run)
            session.flush()
            evidence_ids: dict[str, str] = {}
            for source in entry["sources"]:
                source_key = str(source["key"])
                excerpt = str(source["excerpt"])
                digest = sha256(excerpt.encode()).hexdigest()
                source_id = source_ids[source_key]
                evidence_id = stable_id(f"evidence/{domain}/{source_key}")
                evidence_ids[source_key] = evidence_id
                source_document = StoredSourceDocument(
                    id=source_id,
                    company_id=company.id,
                    research_run_id=run_id,
                    canonical_url=str(source["url"]),
                    source_type=str(source["type"]),
                    title=str(source["title"]),
                    retrieved_at=now,
                    publication_date=parsed_date(source["publication_date"]),
                    event_date=parsed_date(source["publication_date"]),
                    content_hash=digest,
                    normalized_text=excerpt,
                    text_expires_at=now + timedelta(days=30),
                )
                session.add(source_document)
                session.flush()
                evidence = StoredEvidence(
                    id=evidence_id,
                    source_id=source_id,
                    excerpt=excerpt,
                    start_offset=0,
                    end_offset=len(excerpt),
                    factual_claim=str(source["claim"]),
                    event_group_key=str(source["event"]),
                )
                session.add(evidence)
                session.flush()
                session.add(
                    EvidenceTranslation(
                        id=stable_id(f"translation/{domain}/{source_key}/en"),
                        evidence_id=evidence_id,
                        target_language="en",
                        provider_model="verified-translation-v1",
                        source_text_hash=digest,
                        translated_excerpt=str(source["translation"]),
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                        cost_usd=0.0,
                    )
                )
            contributions: list[dict[str, object]] = []
            for assessment in entry["assessments"]:
                signal_id = str(assessment["signal_id"])
                related_evidence = [evidence_ids[key] for key in assessment["source_keys"]]
                session.add(
                    StoredSignalAssessment(
                        id=stable_id(f"assessment/{domain}/{signal_id}"),
                        research_run_id=run_id,
                        company_id=company.id,
                        profile_version_id=profile_version.id,
                        signal_id=signal_id,
                        status=str(assessment["status"]),
                        evidence_strength=assessment["strength"],
                        evidence_ids=related_evidence,
                        rationale=str(assessment["rationale"]),
                        model_version="verified-public-sources",
                        prompt_version="reference-v1",
                    )
                )
                if assessment["status"] == "supported":
                    contributions.append(
                        {
                            "signal_id": signal_id,
                            "effect": "positive",
                            "weighted_value": 20,
                            "evidence_ids": related_evidence,
                        }
                    )
            session.add(
                StoredScoreSnapshot(
                    id=stable_id(f"score/{domain}"),
                    research_run_id=run_id,
                    company_id=company.id,
                    profile_version_id=profile_version.id,
                    calculation_version="2.0",
                    score=94,
                    eligibility="eligible",
                    coverage=0.8,
                    icp_fit=1.0,
                    positive_strength=1.0,
                    penalty_points=0,
                    contributions=contributions,
                    exclusion_reasons=[],
                    warnings=[],
                )
            )


def seed_profiles() -> None:
    with SessionLocal.begin() as session:
        default_profile = session.scalar(
            select(ServiceProfile).where(ServiceProfile.name == DEFAULT_PROFILE_NAME)
        )
        legacy_profile = session.scalar(
            select(ServiceProfile).where(ServiceProfile.name == LEGACY_DEFAULT_PROFILE_NAME)
        )
        if default_profile is None and legacy_profile is not None:
            legacy_profile.name = DEFAULT_PROFILE_NAME
        for preset in load_presets():
            if session.scalar(select(ServiceProfile).where(ServiceProfile.name == preset.name)):
                continue
            profile = ServiceProfile(name=preset.name)
            profile.versions.append(
                ServiceProfileVersion(
                    version=1, configuration=preset.configuration.model_dump(mode="json")
                )
            )
            session.add(profile)

    seed_reference_research()


if __name__ == "__main__":
    seed_profiles()
