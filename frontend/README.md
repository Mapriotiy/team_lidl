# Orange Signal — dashboard

React dashboard for the Orange Signal sales-intelligence API. It shows ranked leads, the full
evidence trail behind every score, and the signal/ICP configuration that sales owns.

Vite + React 18 + TypeScript, plain CSS with custom-property design tokens in `src/styles.css`.
No component library, no chart library, no router — the charts are hand-drawn inline SVG and
views switch on component state.

## Run it

```bash
# 1. start the API from the project root (defaults to http://localhost:8080)
cd ..
npm run api

# 2. start the dashboard
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build        # type-checks, then emits dist/
npm run preview      # serve dist/ locally
```

## Configuration

| Variable       | Default                 | Meaning                       |
| -------------- | ----------------------- | ----------------------------- |
| `VITE_API_URL` | `http://localhost:8080` | Base URL of the Express API   |

Copy `.env.example` to `.env` to change it. The value is read at build time, so restart the dev
server after editing. The API URL in use is shown at the bottom of the sidebar.

## Views

| View              | What it is for                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Leads**         | KPI row, score-distribution histogram, and the ranked table. Filter by band and minimum score.   |
| **Lead detail**   | Score decomposition (fit / intent / penalty), every signal with its evidence, outreach drafting. |
| **Signal config** | Add, edit, enable and delete the questions asked of each company, then re-score.                 |
| **ICP**           | Countries, industries, employee range, exclusions and the fit weight.                            |
| **Sources**       | Documents per company by source, and the crawl log including failures.                           |

## How it is put together

```
src/
  api.ts               typed client; coerces Postgres strings to numbers, surfaces {error} bodies
  hooks.ts             useAsync — keeps stale data while refetching, ignores superseded responses
  styles.css           design tokens + all component styles
  components/ui.tsx    chips, KPI tiles, loading/empty/error blocks, formatters
  components/Charts.tsx  three inline-SVG charts
  views/               one file per view
```

A few decisions worth knowing:

- **Everything numeric goes through `num()`** at the API boundary. Postgres returns `count(*)` and
  `numeric` columns as strings, so `total`, `document_count`, `fit_weight` and friends would
  otherwise sort and format wrongly.
- **Loading, empty and error states are handled per panel**, not per page, so one dead endpoint
  does not blank the screen. An error boundary catches render bugs as a last resort.
- **Charts are hand-drawn SVG.** Bars start at zero, band cut-offs (25 / 45 / 70) are marked, and
  disqualified leads are excluded from the histogram rather than piling up in the 0–10 bucket,
  where they would fake a spike — the scorer forces their total to zero.
- **Colour is load-bearing.** The band ramp runs warm (hot) to cool (cold) because bands are
  ordinal; disqualified sits off that scale as struck-through stone with a red rule. The
  interactive accent is teal so no control can be mistaken for a hot score. Band chips always
  carry their label, so colour is never the only cue.

## Known API gaps

- `GET /api/leads/:companyId` can return `score: null` for a company that exists but has not been
  scored for the selected service. The detail view renders an explanatory empty state.
- There is no endpoint that lists companies, so the Sources view builds its company list from
  `GET /api/leads` — a company with no `lead_scores` row is therefore invisible there.
- `POST /api/leads/:companyId/outreach` fails with a 500 when the lead has no verified positive
  signals. The message is shown to the user as-is.
