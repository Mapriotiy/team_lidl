/**
 * REST API consumed by the React dashboard.
 * Read endpoints are plain SQL over the scored data; write endpoints let sales
 * reconfigure ICP, questions and weights without touching code.
 */
import express from "express";
import cors from "cors";
import { q, one } from "../db.js";
import { settings } from "../settings.js";
import { ingestCompany } from "../pipeline/ingest.js";
import { crawlStatus, startCrawl } from "./crawl-job.js";
import { evaluateCompanyForService } from "../signals/evaluate.js";
import { scoreCompanyForService } from "../scoring/score.js";
import { draftOutreach } from "../outreach/draft.js";
import { serviceByKey, wrap } from "./helpers.js";
import { analytics } from "./routes/analytics.js";
import { workspace } from "./routes/workspace.js";
import type { Company } from "../types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/stats", wrap(async (_req, res) => {
  const [stats] = await q(`
    SELECT
      (SELECT count(*) FROM companies)                           AS companies,
      (SELECT count(*) FROM documents)                           AS documents,
      (SELECT count(*) FROM signal_answers WHERE verdict='yes')  AS signals_detected,
      (SELECT count(*) FROM lead_scores WHERE band='hot')        AS hot,
      (SELECT count(*) FROM lead_scores WHERE band='warm')       AS warm,
      (SELECT count(*) FROM lead_scores WHERE disqualified)      AS disqualified`);
  res.json(stats);
}));

app.get("/api/services", wrap(async (_req, res) => {
  res.json(await q(`
    SELECT s.*, (SELECT count(*) FROM signal_questions WHERE service_id=s.id AND enabled) AS question_count
      FROM services s WHERE s.active ORDER BY s.name`));
}));

app.get("/api/services/:key/questions", wrap(async (req, res) => {
  const service = await serviceByKey(String(req.params.key));
  if (!service) return res.status(404).json({ error: "unknown service" });
  res.json(await q(`SELECT * FROM signal_questions WHERE service_id=$1 ORDER BY polarity, key`, [service.id]));
}));

app.post("/api/services/:key/questions", wrap(async (req, res) => {
  const service = await serviceByKey(String(req.params.key));
  if (!service) return res.status(404).json({ error: "unknown service" });
  const { key, text, weight = "medium", polarity = "positive", source_kinds = ["website", "jobs", "news"], half_life_days = 180 } = req.body ?? {};
  if (!key || !text) return res.status(400).json({ error: "key and text are required" });
  const row = await one(
    `INSERT INTO signal_questions (service_id, key, text, weight, polarity, source_kinds, half_life_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (service_id, key) DO UPDATE SET text=EXCLUDED.text, weight=EXCLUDED.weight,
       polarity=EXCLUDED.polarity, source_kinds=EXCLUDED.source_kinds, half_life_days=EXCLUDED.half_life_days
     RETURNING *`,
    [service.id, key, text, weight, polarity, source_kinds, half_life_days],
  );
  res.status(201).json(row);
}));

app.patch("/api/questions/:id", wrap(async (req, res) => {
  const allowed = ["text", "weight", "polarity", "half_life_days", "enabled", "source_kinds"];
  const sets: string[] = [];
  const vals: unknown[] = [req.params.id];
  for (const [k, v] of Object.entries(req.body ?? {})) {
    if (!allowed.includes(k)) continue;
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: "nothing to update" });
  const row = await one(`UPDATE signal_questions SET ${sets.join(", ")} WHERE id=$1 RETURNING *`, vals);
  res.json(row);
}));

app.delete("/api/questions/:id", wrap(async (req, res) => {
  await q(`DELETE FROM signal_questions WHERE id=$1`, [req.params.id]);
  res.status(204).end();
}));

app.get("/api/icp/:key", wrap(async (req, res) => {
  const service = await serviceByKey(String(req.params.key));
  if (!service) return res.status(404).json({ error: "unknown service" });
  res.json((await one(`SELECT * FROM icp_profiles WHERE service_id=$1 LIMIT 1`, [service.id])) ?? null);
}));

app.put("/api/icp/:key", wrap(async (req, res) => {
  const service = await serviceByKey(String(req.params.key));
  if (!service) return res.status(404).json({ error: "unknown service" });
  const { name = "Default ICP", countries = [], industries = [], min_employees = null, max_employees = null, exclude_industries = [], fit_weight = 0.3 } = req.body ?? {};
  await q(`DELETE FROM icp_profiles WHERE service_id=$1`, [service.id]);
  const row = await one(
    `INSERT INTO icp_profiles (service_id, name, countries, industries, min_employees, max_employees, exclude_industries, fit_weight)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [service.id, name, countries, industries, min_employees, max_employees, exclude_industries, fit_weight],
  );
  res.json(row);
}));

/** Ranked lead list - the main dashboard view. */
app.get("/api/leads", wrap(async (req, res) => {
  const serviceKey = String(req.query.service ?? "");
  const service = serviceKey ? await serviceByKey(serviceKey) : null;
  if (serviceKey && !service) return res.status(404).json({ error: "unknown service" });

  const rows = await q(`
    SELECT c.id, c.name, c.domain, c.country, c.industry, c.employee_count, c.ats_provider,
           s.key AS service_key, s.name AS service_name,
           ls.total, ls.band, ls.fit_score, ls.intent_score, ls.penalty, ls.disqualified,
           ls.computed_at, ls.breakdown -> 'top_reasons' AS top_reasons,
           (SELECT count(*) FROM documents d WHERE d.company_id=c.id) AS document_count
      FROM lead_scores ls
      JOIN companies c ON c.id = ls.company_id
      JOIN services  s ON s.id = ls.service_id
     WHERE ($1::uuid IS NULL OR ls.service_id = $1)
       AND ($2::text IS NULL OR ls.band = $2)
       AND ls.total >= $3
     ORDER BY ls.disqualified ASC, ls.total DESC
     LIMIT $4`,
    [service?.id ?? null, req.query.band ? String(req.query.band) : null, Number(req.query.minScore ?? 0), Number(req.query.limit ?? 100)],
  );
  res.json(rows);
}));

/** Full evidence trail for one lead - the "why" panel. */
app.get("/api/leads/:companyId", wrap(async (req, res) => {
  const serviceKey = String(req.query.service ?? "");
  const service = await serviceByKey(serviceKey);
  if (!service) return res.status(404).json({ error: "unknown or missing service" });

  const company = await one<Company>(`SELECT * FROM companies WHERE id=$1`, [req.params.companyId]);
  if (!company) return res.status(404).json({ error: "unknown company" });

  const score = await one(`SELECT * FROM lead_scores WHERE company_id=$1 AND service_id=$2`, [company.id, service.id]);
  const sources = await q(
    `SELECT source_kind, source_name, count(*)::int AS n, max(published_at) AS newest
       FROM documents WHERE company_id=$1 GROUP BY 1,2 ORDER BY 3 DESC`,
    [company.id],
  );
  const drafts = await q(`SELECT * FROM outreach_drafts WHERE company_id=$1 AND service_id=$2 ORDER BY created_at DESC LIMIT 5`, [company.id, service.id]);
  res.json({ company, service, score: score ?? null, sources, drafts });
}));

/** Every company, including ones not yet scored - the Sources view needs these. */
app.get("/api/companies", wrap(async (_req, res) => {
  res.json(await q(`
    SELECT c.id, c.name, c.domain, c.country, c.industry, c.employee_count,
           c.ats_provider, c.ats_slug, c.careers_url, c.updated_at,
           (SELECT count(*)::int FROM documents d WHERE d.company_id = c.id)   AS document_count,
           (SELECT count(*)::int FROM lead_scores l WHERE l.company_id = c.id) AS score_count
      FROM companies c ORDER BY c.name`));
}));

app.get("/api/companies/:id/documents", wrap(async (req, res) => {
  res.json(await q(
    `SELECT id, source_kind, source_name, url, title, published_at, fetched_at, length(content) AS chars
       FROM documents WHERE company_id=$1
      ORDER BY published_at DESC NULLS LAST LIMIT $2`,
    [req.params.id, Number(req.query.limit ?? 200)],
  ));
}));

app.get("/api/crawl-log", wrap(async (req, res) => {
  res.json(await q(`SELECT * FROM crawl_log ORDER BY at DESC LIMIT $1`, [Number(req.query.limit ?? 100)]));
}));

/** Add a prospect and run the full pipeline for it. */
app.post("/api/companies", wrap(async (req, res) => {
  const { name, domain, service } = req.body ?? {};
  if (!name || !domain) return res.status(400).json({ error: "name and domain are required" });

  const { company } = await ingestCompany(name, domain);
  const services = service ? [await serviceByKey(service)].filter(Boolean) : await q<{ id: string }>(`SELECT id FROM services WHERE active`);
  for (const s of services as Array<{ id: string }>) {
    await evaluateCompanyForService(company, s.id);
    await scoreCompanyForService(company, s.id);
  }
  res.status(201).json({ company });
}));

/**
 * Start a crawl from the dashboard. Returns 202 immediately - the work carries
 * on in the background and the client polls GET /api/crawl for progress.
 */
app.post("/api/crawl", wrap(async (req, res) => {
  const companyId = req.body?.company_id ? String(req.body.company_id) : undefined;
  try {
    res.status(202).json(await startCrawl(companyId));
  } catch (err) {
    const message = (err as Error).message;
    // "already running" is a conflict the UI shows as a message, not a fault.
    const status = /already running/.test(message) ? 409 : /unknown company/.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
}));

/** Progress of the current or most recent crawl. */
app.get("/api/crawl", (_req, res) => res.json(crawlStatus()));

/** Re-score without re-running the LLM - instant feedback when weights change. */
app.post("/api/rescore", wrap(async (req, res) => {
  const service = await serviceByKey(String(req.body?.service ?? ""));
  if (!service) return res.status(404).json({ error: "unknown service" });
  const companies = await q<Company>(`SELECT * FROM companies`);
  for (const c of companies) await scoreCompanyForService(c, service.id);
  res.json({ rescored: companies.length });
}));

app.post("/api/leads/:companyId/outreach", wrap(async (req, res) => {
  const company = await one<Company>(`SELECT * FROM companies WHERE id=$1`, [req.params.companyId]);
  if (!company) return res.status(404).json({ error: "unknown company" });
  try {
    const draft = await draftOutreach(company, String(req.body?.service ?? req.query.service ?? ""), String(req.body?.channel ?? "email"));
    return res.json(draft);
  } catch (err) {
    const message = (err as Error).message;
    // "not scored yet" and "nothing worth writing about" are expected states for a
    // cold lead, not server faults. A 500 here makes the dashboard look broken.
    if (/has no verified positive signals|has not been scored|unknown service/.test(message)) {
      return res.status(409).json({ error: message });
    }
    throw err;
  }
}));

/* Analytics and workspace state live in their own routers - see ./routes. */
app.use(analytics);
app.use(workspace);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(settings.apiPort, () => console.log(`API listening on http://localhost:${settings.apiPort}`));
