import json
from collections.abc import Mapping
from datetime import UTC, datetime
from email.message import Message
from io import BytesIO
from unittest import mock
from urllib.error import HTTPError

import pytest

from app.assessment.providers import (
    OpenRouterAssessmentProvider,
    OpenRouterError,
    OpenRouterTransientError,
)
from app.assessment.providers.openrouter import UrlLibJsonPostTransport
from app.collection.models import CollectedDocument
from app.contracts.evidence import SourceType
from app.contracts.profile import ProfileConfiguration, SignalDefinition, SignalEffect


class FakeTransport:
    def __init__(self, response: object) -> None:
        self.response = response
        self.payload: Mapping[str, object] = {}

    def post_json(
        self,
        url: str,
        *,
        payload: Mapping[str, object],
        headers: Mapping[str, str],
        timeout: float,
    ) -> object:
        assert url.endswith("/chat/completions")
        assert headers["Authorization"] == "Bearer secret"
        assert timeout == 30
        self.payload = payload
        return self.response


def profile() -> ProfileConfiguration:
    return ProfileConfiguration(
        service_description="Automation services",
        signals=[
            SignalDefinition(
                id="efficiency",
                question="Is there an efficiency initiative?",
                positive_criteria=["Named initiative"],
                exclusions=[],
                weight=20,
                effect=SignalEffect.POSITIVE,
                freshness_window_days=365,
            )
        ],
    )


def document() -> CollectedDocument:
    return CollectedDocument(
        id="source-1",
        company_id="company-1",
        canonical_url="https://example.com/news",
        source_type=SourceType.COMPANY,
        title="Efficiency",
        retrieved_at=datetime.now(UTC),
        content_hash="sha256:test",
        normalized_text="The company announced an efficiency initiative.",
    )


def response(signal_id: str = "efficiency") -> dict[str, object]:
    content = {
        "assessments": [
            {
                "signal_id": signal_id,
                "status": "supported",
                "evidence": [
                    {
                        "source_id": "source-1",
                        "excerpt": "efficiency initiative",
                        "start_offset": 25,
                        "end_offset": 46,
                        "factual_claim": "The company announced an efficiency initiative.",
                        "event_group_key": "efficiency-2026",
                    }
                ],
                "evidence_strength": "strong",
                "rationale": "A named initiative is present.",
                "model_version": "test-model",
                "prompt_version": "assessment-v1",
            }
        ]
    }
    return {
        "model": "test-model",
        "choices": [{"message": {"content": json.dumps(content)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        "cost": 0.001,
    }


def test_requests_strict_structured_output_and_tracks_usage() -> None:
    transport = FakeTransport(response())
    provider = OpenRouterAssessmentProvider(
        api_key="secret", model="test-model", timeout=30, transport=transport
    )

    batch = provider.assess(
        company_id="company-1",
        company_name="Example",
        profile=profile(),
        documents=[document()],
    )

    assert len(batch.assessments) == 1
    assert batch.total_tokens == 150
    assert batch.cost_usd == 0.001
    response_format = transport.payload["response_format"]
    assert isinstance(response_format, dict)
    assert response_format["type"] == "json_schema"
    assert transport.payload["provider"] == {"require_parameters": True}
    messages = transport.payload["messages"]
    assert isinstance(messages, list)
    system_prompt = messages[0]["content"]
    assert "Optimize for useful lead discovery" in system_prompt
    assert "weak for a credible directional indicator" in system_prompt
    assert "services sold to clients do not establish" in system_prompt


def test_rejects_missing_or_duplicate_signal_results() -> None:
    provider = OpenRouterAssessmentProvider(
        api_key="secret",
        model="test-model",
        timeout=30,
        transport=FakeTransport(response("wrong-signal")),
    )

    with pytest.raises(OpenRouterError, match="exactly one result"):
        provider.assess(
            company_id="company-1",
            company_name="Example",
            profile=profile(),
            documents=[document()],
        )


def test_surfaces_error_field_instead_of_no_choices() -> None:
    provider = OpenRouterAssessmentProvider(
        api_key="secret",
        model="test-model",
        timeout=30,
        transport=FakeTransport(
            {"error": {"code": 400, "message": "model does not support response_format"}}
        ),
    )

    with pytest.raises(OpenRouterError, match="model does not support response_format"):
        provider.assess(
            company_id="company-1",
            company_name="Example",
            profile=profile(),
            documents=[document()],
        )


def test_classifies_provider_overload_as_transient() -> None:
    provider = OpenRouterAssessmentProvider(
        api_key="secret",
        model="test-model",
        timeout=30,
        transport=FakeTransport(
            {
                "error": {
                    "code": 503,
                    "message": "Service temporarily overloaded",
                    "metadata": {"error_type": "provider_overloaded"},
                }
            }
        ),
    )

    with pytest.raises(OpenRouterTransientError, match="Service temporarily overloaded"):
        provider.assess(
            company_id="company-1",
            company_name="Example",
            profile=profile(),
            documents=[document()],
        )


def test_transport_surfaces_http_error_message() -> None:
    body = json.dumps(
        {"error": {"code": 400, "message": "model does not support response_format"}}
    ).encode()
    raised = HTTPError("https://openrouter.ai", 400, "Bad Request", Message(), BytesIO(body))
    with mock.patch(
        "app.assessment.providers.openrouter.urlopen", side_effect=raised
    ):
        with pytest.raises(OpenRouterError, match="model does not support response_format"):
            UrlLibJsonPostTransport().post_json(
                "https://openrouter.ai", payload={}, headers={}, timeout=30
            )


def test_transport_classifies_overload_as_transient() -> None:
    body = json.dumps(
        {
            "error": {
                "code": 503,
                "message": "Service temporarily overloaded",
                "metadata": {"error_type": "provider_overloaded"},
            }
        }
    ).encode()
    raised = HTTPError(
        "https://openrouter.ai", 503, "Service Unavailable", Message(), BytesIO(body)
    )
    with mock.patch(
        "app.assessment.providers.openrouter.urlopen", side_effect=raised
    ):
        with pytest.raises(OpenRouterTransientError, match="Service temporarily overloaded"):
            UrlLibJsonPostTransport().post_json(
                "https://openrouter.ai", payload={}, headers={}, timeout=30
            )
