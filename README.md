# LeadRadar

B2B sales intelligence for prioritizing companies across process automation, cybersecurity, and software development. The product connects configurable business questions to public evidence, explainable scores, and sales actions.

## Project status

48-hour hackathon, five contributors. The initial application scaffold includes a React frontend, FastAPI service, PostgreSQL database, and separate worker process. Product features are divided into parallel workstreams so each contributor can deliver an independently reviewable part of the complete flow.

## Local setup

Copy `.env.example` to `.env`, then start the development stack:

```bash
docker compose up --build
```

The frontend runs at `http://localhost:5173`, the API at `http://localhost:8000`, and generated API documentation at `http://localhost:8000/docs`. Verify the API with `GET http://localhost:8000/health`.

Run services directly when working on one layer:

```bash
cd backend
python -m venv .venv
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Backend checks are `ruff check .`, `mypy app tests`, and `pytest`. Frontend checks are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

The API applies Alembic migrations and loads the three service-profile presets when it starts through Docker Compose. For a direct backend run, execute `alembic upgrade head` and `python -m app.seed` once before starting Uvicorn. Shared response examples live in `backend/app/fixtures/api_examples.json` and are validated by the backend test suite.

## Team documentation

- [Execution plan](docs/execution-plan.md): ownership, milestones, ordered backlog, and delivery gates.
- [Architecture and contracts](docs/architecture.md): stack, data model, research pipeline, and API behavior.
- [Product scope](docs/product-scope.md): user flows, service presets, and release boundaries.
- [Contribution guide](CONTRIBUTING.md): branches, commits, reviews, squash merges, and repository settings.
- [Quality and demo](docs/quality-and-demo.md): acceptance checks, evaluation dataset, and presentation runbook.
- [Parallel workstreams](docs/parallel-workstreams.md): five-person ownership, contracts, merge order, and agent-ready work packets.
- [Annex alignment](docs/annex-alignment.md): traceability to the supplied participant reference pack.

Start with the execution plan, claim a work item, and follow the contribution guide. Keep `main` deployable.
