import logging
import time
from concurrent.futures import ThreadPoolExecutor

from app.assessment.providers import OpenRouterAssessmentProvider
from app.config import get_settings
from app.db import SessionLocal
from app.discovery import NewsApiDiscovery
from app.jobs.runner import ResearchPipeline, UnconfiguredPipeline, run_once
from app.research import IntegratedResearchPipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run(pipeline: ResearchPipeline | None = None) -> None:
    settings = get_settings()
    if pipeline is None:
        if settings.openrouter_api_key and settings.assessment_model:
            newsapi = (
                NewsApiDiscovery(api_key=settings.newsapi_key)
                if settings.newsapi_key
                else None
            )
            pipeline = IntegratedResearchPipeline(
                SessionLocal,
                OpenRouterAssessmentProvider(
                    api_key=settings.openrouter_api_key,
                    model=settings.assessment_model,
                    timeout=settings.assessment_timeout_seconds,
                ),
                newsapi=newsapi,
                retention_days=settings.source_text_retention_days,
                budget_usd=settings.research_budget_usd,
            )
            if newsapi:
                logger.info("NewsAPI news enrichment enabled")
            logger.info("Research pipeline configured with model %s", settings.assessment_model)
        else:
            pipeline = UnconfiguredPipeline()
            logger.warning(
                "Research pipeline is NOT configured: set OPENROUTER_API_KEY and "
                "ASSESSMENT_MODEL in the worker environment to run real research"
            )
    logger.info("Worker started with %s concurrent research slots", settings.worker_concurrency)

    def work(slot: int) -> None:
        logger.info("Research slot %s started", slot)
        while True:
            try:
                if not run_once(SessionLocal, pipeline):
                    time.sleep(2)
            except Exception:
                logger.exception("Worker iteration failed in slot %s", slot)
                time.sleep(5)

    if settings.worker_concurrency == 1:
        work(1)
        return
    with ThreadPoolExecutor(
        max_workers=settings.worker_concurrency, thread_name_prefix="research"
    ) as pool:
        list(pool.map(work, range(1, settings.worker_concurrency + 1)))


if __name__ == "__main__":
    run()
