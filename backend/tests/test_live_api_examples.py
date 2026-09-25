import json
from pathlib import Path

from app.api.result_contracts import CompanyResultRead, OpportunityPage, TranslationRead


def test_live_api_examples_match_frozen_response_contracts() -> None:
    fixture = Path(__file__).parents[1] / "app" / "fixtures" / "live_api_examples.json"
    examples = json.loads(fixture.read_text(encoding="utf-8"))
    OpportunityPage.model_validate(examples["opportunity_list"]["response"])
    CompanyResultRead.model_validate(examples["company_detail"]["response"])
    TranslationRead.model_validate(examples["evidence_translation"]["response"])
