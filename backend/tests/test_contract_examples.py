import json
from importlib.resources import files

from app.contracts import (
    CompanySummary,
    EvidenceExcerpt,
    OpportunityListItem,
    ProfileRead,
    ResearchRunRead,
    ScoreSnapshot,
    SourceDocument,
)


def test_shared_api_examples_match_contracts() -> None:
    content = files("app.fixtures").joinpath("api_examples.json").read_text(encoding="utf-8")
    examples = json.loads(content)

    ProfileRead.model_validate(examples["service_profile"])
    CompanySummary.model_validate(examples["company_summary"])
    SourceDocument.model_validate(examples["source_document"])
    EvidenceExcerpt.model_validate(examples["evidence_excerpt"])
    ScoreSnapshot.model_validate(examples["score_snapshot"])
    ResearchRunRead.model_validate(examples["research_run"])
    OpportunityListItem.model_validate(examples["opportunity"])
