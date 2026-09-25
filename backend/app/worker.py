import logging
import time

from app.assessment.providers import OpenRouterAssessmentProvider
from app.config import get_settings
from app.db import SessionLocal
from app.jobs.runner import ResearchPipeline, UnconfiguredPipeline, run_once
from app.research import IntegratedResearchPipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run(pipeline: ResearchPipeline | None = None) -> None:
    if pipeline is None:
        settings = get_settings()
        if settings.openrouter_api_key and settings.assessment_model:
            pipeline = IntegratedResearchPipeline(
                SessionLocal,
                OpenRouterAssessmentProvider(
                    api_key=settings.openrouter_api_key,
                    model=settings.assessment_model,
                    timeout=settings.assessment_timeout_seconds,
                ),
                retention_days=settings.source_text_retention_days,
                budget_usd=settings.research_budget_usd,
            )
        else:
            pipeline = UnconfiguredPipeline()
    logger.info("Worker started")
    while True:
        try:
            if not run_once(SessionLocal, pipeline):
                time.sleep(2)
        except Exception:
            logger.exception("Worker iteration failed")
            time.sleep(5)


if __name__ == "__main__":
    run()
