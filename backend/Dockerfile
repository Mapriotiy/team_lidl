FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

FROM base AS development
RUN pip install --no-cache-dir ".[dev]" \
    && python -m playwright install --with-deps chromium
COPY . .

FROM base AS production
COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

