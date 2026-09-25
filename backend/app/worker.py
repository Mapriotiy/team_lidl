import logging
import time

from sqlalchemy import text

from app.db import create_database_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run() -> None:
    engine = create_database_engine()
    logger.info("Worker started")

    while True:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            logger.info("Worker database heartbeat succeeded")
        except Exception:
            logger.exception("Worker database heartbeat failed")
        time.sleep(30)


if __name__ == "__main__":
    run()

