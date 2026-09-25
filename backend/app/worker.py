import logging
import time

from app.db import SessionLocal
from app.jobs.runner import ResearchPipeline, UnconfiguredPipeline, run_once

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run(pipeline: ResearchPipeline | None = None) -> None:
    pipeline = pipeline or UnconfiguredPipeline()
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
