/**
 * Read-only analytics for the Signals, Data sources and Reports screens.
 *
 * Every number here is derived from stored rows - documents, signal_answers,
 * lead_scores, crawl_log. Nothing is estimated or seeded, so an empty database
 * produces empty charts rather than plausible-looking fiction.
 */
import { Router } from "express";
import { q, one } from "../../db.js";
import { asInt, resolveService, wrap } from "../helpers.js";

export const analytics = Router();

/** crawl_log records the adapter that ran; the dashboard groups by source kind. */
const KIND_OF_SOURCE: Record<string, string> = {
  ats: "jobs",
  greenhouse: "jobs",
  lever: "jobs",
  workable: "jobs",
  personio: "jobs",
  recruitee: "jobs",
  smartrecruiters: "jobs",
  ashby: "jobs",
  teamtailor: "jobs",
  news: "news",
  gdelt: "news",
  google_news: "news",
  "gdelt+google_news": "news",
  website: "website",
  firmographics: "firmographics",
  wikidata: "firmographics",
  crunchbase: "firmographics",
};

const kindOf = (sourceName: string): string => KIND_OF_SOURCE[sourceName] ?? "website";

/* --------------------------------------------------------------- signals */

/**
 * The live signal feed. One row per confirmed signal, newest first, carrying
 * the company it fired for and the evidence that justified it.
 */
analytics.get(
  "/api/signals/recent",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });

    const kind = typeof req.query.kind === "string" && req.query.kind ? req.query.kind : null;
    const rows = await q(
      `SELECT sa.id, sa.verdict, sa.confidence, sa.rationale, sa.evidence, sa.evaluated_at,
              c.id AS company_id, c.name AS company_name, c.domain, c.industry,
              sq.key AS question_key, sq.text AS question, sq.polarity, sq.weight, sq.source_kinds,
              ls.total AS company_score, ls.band
         FROM signal_answers   sa
         JOIN signal_questions sq ON sq.id = sa.question_id
         JOIN companies        c  ON c.id  = sa.company_id
         LEFT JOIN lead_scores ls ON ls.company_id = c.id AND ls.service_id = sq.service_id
        WHERE sa.verdict = 'yes'
          AND ($1::uuid IS NULL OR sq.service_id = $1)
          AND ($2::text IS NULL OR $2 = ANY (sq.source_kinds))
        ORDER BY sa.evaluated_at DESC
        LIMIT $3`,
      [service?.id ?? null, kind, asInt(req.query.limit, 40, 200)],
    );
    res.json(rows);
  }),
);

/** How often each configured question actually fires - the volume bars. */
analytics.get(
  "/api/signals/volume",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });

    res.json(
      await q(
        `SELECT sq.id, sq.key, sq.text, sq.polarity, sq.weight, sq.enabled, sq.source_kinds,
                count(sa.id)                                    AS evaluated,
                count(*) FILTER (WHERE sa.verdict = 'yes')      AS confirmed,
                count(*) FILTER (WHERE sa.verdict = 'no')       AS not_found,
                count(*) FILTER (WHERE sa.verdict = 'unknown')  AS unknown
           FROM signal_questions sq
           LEFT JOIN signal_answers sa ON sa.question_id = sq.id
          WHERE ($1::uuid IS NULL OR sq.service_id = $1)
          GROUP BY sq.id
          ORDER BY confirmed DESC, sq.key`,
        [service?.id ?? null],
      ),
    );
  }),
);

/* ---------------------------------------------------------- data sources */

/** Per-adapter health: volume, freshness, last-24h success rate, on/off. */
analytics.get(
  "/api/sources",
  wrap(async (_req, res) => {
    const [settings, byKind, adapters, log, hist] = await Promise.all([
      q(`SELECT source_kind, enabled, updated_at FROM source_settings ORDER BY source_kind`),
      q(`SELECT source_kind,
                count(*)::int                    AS documents,
                count(DISTINCT company_id)::int  AS companies,
                max(fetched_at)                  AS last_fetch,
                max(published_at)                AS newest_evidence
           FROM documents GROUP BY 1`),
      q(`SELECT source_kind, source_name, count(*)::int AS documents, max(fetched_at) AS last_fetch
           FROM documents GROUP BY 1, 2 ORDER BY 3 DESC`),
      q(`SELECT source_name,
                count(*)::int                                  AS attempts,
                count(*) FILTER (WHERE status = 'ok')::int     AS ok,
                count(*) FILTER (WHERE status = 'error')::int  AS failed,
                max(at)                                        AS last_attempt,
                max(detail) FILTER (WHERE status = 'error')    AS last_error
           FROM crawl_log WHERE at > now() - interval '24 hours' GROUP BY 1`),
      q(`SELECT date_trunc('hour', at) AS hour,
                count(*) FILTER (WHERE status = 'ok')::int     AS ok,
                count(*) FILTER (WHERE status <> 'ok')::int    AS failed
           FROM crawl_log WHERE at > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`),
    ]);

    // Fold the per-adapter crawl log up into the four source kinds the UI shows.
    const health = new Map<string, { attempts: number; ok: number; failed: number; last_error: string | null }>();
    for (const row of log as Array<Record<string, any>>) {
      const kind = kindOf(row.source_name);
      const cur = health.get(kind) ?? { attempts: 0, ok: 0, failed: 0, last_error: null };
      health.set(kind, {
        attempts: cur.attempts + Number(row.attempts),
        ok: cur.ok + Number(row.ok),
        failed: cur.failed + Number(row.failed),
        last_error: cur.last_error ?? row.last_error ?? null,
      });
    }

    const volume = new Map((byKind as Array<Record<string, any>>).map((r) => [r.source_kind, r]));

    res.json({
      sources: (settings as Array<Record<string, any>>).map((s) => {
        const v = volume.get(s.source_kind);
        const h = health.get(s.source_kind);
        return {
          source_kind: s.source_kind,
          enabled: s.enabled,
          updated_at: s.updated_at,
          documents: Number(v?.documents ?? 0),
          companies: Number(v?.companies ?? 0),
          last_fetch: v?.last_fetch ?? null,
          newest_evidence: v?.newest_evidence ?? null,
          attempts_24h: h?.attempts ?? 0,
          ok_24h: h?.ok ?? 0,
          failed_24h: h?.failed ?? 0,
          last_error: h?.last_error ?? null,
          adapters: (adapters as Array<Record<string, any>>)
            .filter((a) => a.source_kind === s.source_kind)
            .map((a) => ({ name: a.source_name, documents: a.documents, last_fetch: a.last_fetch })),
        };
      }),
      hourly: hist,
    });
  }),
);

/** Switch an adapter off. ingest.ts honours this on the next run. */
analytics.patch(
  "/api/sources/:kind",
  wrap(async (req, res) => {
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be true or false" });
    }
    const row = await one(
      `UPDATE source_settings SET enabled=$2, updated_at=now() WHERE source_kind=$1 RETURNING *`,
      [req.params.kind, req.body.enabled],
    );
    if (!row) return res.status(404).json({ error: "unknown source kind" });
    res.json(row);
  }),
);

/* ---------------------------------------------------------------- reports */

analytics.get(
  "/api/reports/summary",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });
    const serviceId = service?.id ?? null;
    const weeks = Math.max(4, asInt(req.query.weeks, 12, 52));

    const [totals, prior, bands, segments, distribution, docWeeks, signalWeeks, questions, coverage] =
      await Promise.all([
        one(
          `SELECT count(*)::int                                          AS scored,
                  count(*) FILTER (WHERE band = 'hot')::int              AS hot,
                  count(*) FILTER (WHERE band = 'warm')::int             AS warm,
                  count(*) FILTER (WHERE disqualified)::int              AS disqualified,
                  COALESCE(avg(total)  FILTER (WHERE NOT disqualified), 0) AS avg_score,
                  COALESCE(avg(fit_score)    FILTER (WHERE NOT disqualified), 0) AS avg_fit,
                  COALESCE(avg(intent_score) FILTER (WHERE NOT disqualified), 0) AS avg_intent,
                  max(computed_at)                                       AS last_scored
             FROM lead_scores WHERE ($1::uuid IS NULL OR service_id = $1)`,
          [serviceId],
        ),
        // The same figures as of the start of the window, so deltas are real.
        one(
          `SELECT count(*)::int AS scored,
                  count(*) FILTER (WHERE band = 'hot')::int AS hot
             FROM lead_scores
            WHERE ($1::uuid IS NULL OR service_id = $1)
              AND computed_at < now() - make_interval(weeks => $2)`,
          [serviceId, weeks],
        ),
        q(
          `SELECT band, count(*)::int AS n FROM lead_scores
            WHERE ($1::uuid IS NULL OR service_id = $1) GROUP BY 1`,
          [serviceId],
        ),
        q(
          `SELECT COALESCE(NULLIF(trim(c.industry), ''), 'Unclassified') AS industry,
                  count(*)::int AS n,
                  avg(ls.total) AS avg_score,
                  count(*) FILTER (WHERE ls.band IN ('hot','warm'))::int AS qualified
             FROM lead_scores ls JOIN companies c ON c.id = ls.company_id
            WHERE ($1::uuid IS NULL OR ls.service_id = $1) AND NOT ls.disqualified
            GROUP BY 1 ORDER BY qualified DESC, n DESC LIMIT 6`,
          [serviceId],
        ),
        q(
          `SELECT LEAST(9, floor(total / 10))::int AS decile, count(*)::int AS n
             FROM lead_scores
            WHERE ($1::uuid IS NULL OR service_id = $1) AND NOT disqualified
            GROUP BY 1 ORDER BY 1`,
          [serviceId],
        ),
        q(
          `SELECT date_trunc('week', fetched_at) AS week, count(*)::int AS n
             FROM documents WHERE fetched_at > now() - make_interval(weeks => $1)
            GROUP BY 1 ORDER BY 1`,
          [weeks],
        ),
        q(
          `SELECT date_trunc('week', sa.evaluated_at) AS week, count(*)::int AS n
             FROM signal_answers sa JOIN signal_questions sq ON sq.id = sa.question_id
            WHERE sa.verdict = 'yes'
              AND sa.evaluated_at > now() - make_interval(weeks => $1)
              AND ($2::uuid IS NULL OR sq.service_id = $2)
            GROUP BY 1 ORDER BY 1`,
          [weeks, serviceId],
        ),
        q(
          `SELECT sq.key, sq.text, sq.polarity,
                  count(*) FILTER (WHERE sa.verdict = 'yes')::int AS confirmed
             FROM signal_questions sq LEFT JOIN signal_answers sa ON sa.question_id = sq.id
            WHERE ($1::uuid IS NULL OR sq.service_id = $1) AND sq.enabled
            GROUP BY sq.id ORDER BY confirmed DESC LIMIT 8`,
          [serviceId],
        ),
        one(
          `SELECT count(*)::int AS companies,
                  (SELECT count(*)::int FROM documents) AS documents,
                  (SELECT count(*)::int FROM companies c
                     WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.company_id = c.id)) AS without_evidence
             FROM companies`,
        ),
      ]);

    // Align the two weekly series onto one axis so the chart can plot them together.
    const byWeek = new Map<string, { week: string; documents: number; signals: number }>();
    for (const r of docWeeks as Array<Record<string, any>>) {
      const k = new Date(r.week).toISOString();
      byWeek.set(k, { week: k, documents: Number(r.n), signals: 0 });
    }
    for (const r of signalWeeks as Array<Record<string, any>>) {
      const k = new Date(r.week).toISOString();
      const cur = byWeek.get(k) ?? { week: k, documents: 0, signals: 0 };
      cur.signals = Number(r.n);
      byWeek.set(k, cur);
    }

    res.json({
      service: service?.key ?? null,
      weeks,
      totals,
      prior,
      bands,
      segments,
      distribution,
      questions,
      coverage,
      timeline: [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week)),
    });
  }),
);

/** The Export button. Ranked leads as CSV, straight out of lead_scores. */
analytics.get(
  "/api/reports/export.csv",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });

    const rows = await q<Record<string, unknown>>(
      `SELECT c.name, c.domain, c.country, c.industry, c.employee_count,
              s.key AS service, ls.total, ls.band, ls.fit_score, ls.intent_score,
              ls.penalty, ls.disqualified, ls.computed_at
         FROM lead_scores ls
         JOIN companies c ON c.id = ls.company_id
         JOIN services  s ON s.id = ls.service_id
        WHERE ($1::uuid IS NULL OR ls.service_id = $1)
        ORDER BY ls.disqualified, ls.total DESC`,
      [service?.id ?? null],
    );

    const cols = [
      "name", "domain", "country", "industry", "employee_count", "service",
      "total", "band", "fit_score", "intent_score", "penalty", "disqualified", "computed_at",
    ];
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orange-signal-${service?.key ?? "all"}-${stamp}.csv"`);
    res.send(csv);
  }),
);
