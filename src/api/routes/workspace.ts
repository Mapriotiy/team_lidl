/**
 * Workspace state: outreach sequences, report schedules, members and settings.
 *
 * A sequence stores an audience *rule* (minimum score, optional band) rather
 * than a frozen list, so the audience count tracks the latest scoring run.
 * Enrolment is the separate, deliberate act of pulling those companies in.
 */
import { Router } from "express";
import { q, one } from "../../db.js";
import { settings as runtime } from "../../settings.js";
import { cleanHeaders, describeLlmConfig, loadLlmConfig, saveLlmConfig } from "../../llm/config.js";
import { listModels, testConnection, LlmError } from "../../llm/client.js";
import { secretIsManaged } from "../../llm/crypto.js";
import { asInt, asStrArray, resolveService, serviceByKey, wrap } from "../helpers.js";

export const workspace = Router();

const BANDS = ["hot", "warm", "nurture", "cold"];

interface Step {
  day: number;
  channel: string;
  label: string;
}

/** Steps are operator-authored, so clamp them rather than trusting the body. */
function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((s: any, i) => ({
      day: Math.max(1, Math.min(365, Math.round(Number(s?.day) || i + 1))),
      channel: ["email", "linkedin", "call", "task"].includes(String(s?.channel)) ? String(s.channel) : "email",
      label: String(s?.label ?? "").slice(0, 200).trim() || "Untitled step",
    }))
    .sort((a, b) => a.day - b.day);
}

/* ------------------------------------------------------------- sequences */

const SEQUENCE_SELECT = `
  SELECT seq.id, seq.name, seq.description, seq.min_score, seq.band, seq.steps, seq.status,
         seq.created_at, seq.updated_at,
         s.key AS service_key, s.name AS service_name,
         (SELECT count(*)::int FROM sequence_enrollments e
           WHERE e.sequence_id = seq.id AND e.status = 'enrolled')          AS enrolled,
         (SELECT max(e.enrolled_at) FROM sequence_enrollments e
           WHERE e.sequence_id = seq.id)                                    AS last_enrolled_at,
         (SELECT count(*)::int FROM lead_scores ls
           WHERE ls.service_id = seq.service_id AND NOT ls.disqualified
             AND ls.total >= seq.min_score
             AND (seq.band IS NULL OR ls.band = seq.band))                  AS audience,
         (SELECT count(DISTINCT od.company_id)::int
            FROM outreach_drafts od
            JOIN sequence_enrollments e2
              ON e2.company_id = od.company_id AND e2.sequence_id = seq.id
           WHERE od.service_id = seq.service_id)                            AS drafted
    FROM outreach_sequences seq
    JOIN services s ON s.id = seq.service_id`;

workspace.get(
  "/api/sequences",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });
    res.json(
      await q(`${SEQUENCE_SELECT} WHERE ($1::uuid IS NULL OR seq.service_id = $1) ORDER BY seq.created_at DESC`, [
        service?.id ?? null,
      ]),
    );
  }),
);

workspace.post(
  "/api/sequences",
  wrap(async (req, res) => {
    const service = await serviceByKey(String(req.body?.service ?? ""));
    if (!service) return res.status(404).json({ error: "unknown or missing service" });

    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const band = req.body?.band && BANDS.includes(String(req.body.band)) ? String(req.body.band) : null;
    const steps = cleanSteps(req.body?.steps);

    const row = await one(
      `INSERT INTO outreach_sequences (service_id, name, description, min_score, band, steps, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'active')
       ON CONFLICT (service_id, name) DO UPDATE
         SET description = EXCLUDED.description, min_score = EXCLUDED.min_score,
             band = EXCLUDED.band, steps = EXCLUDED.steps, updated_at = now()
       RETURNING id`,
      [
        service.id,
        name,
        String(req.body?.description ?? "").trim() || null,
        Math.max(0, Math.min(100, Number(req.body?.min_score) || 0)),
        band,
        JSON.stringify(steps.length ? steps : [{ day: 1, channel: "email", label: "First touch" }]),
      ],
    );
    res.status(201).json(await one(`${SEQUENCE_SELECT} WHERE seq.id = $1`, [(row as any).id]));
  }),
);

workspace.patch(
  "/api/sequences/:id",
  wrap(async (req, res) => {
    const sets: string[] = [];
    const vals: unknown[] = [req.params.id];
    const push = (sql: string, value: unknown) => {
      vals.push(value);
      sets.push(`${sql} = $${vals.length}`);
    };

    const body = req.body ?? {};
    if (typeof body.name === "string" && body.name.trim()) push("name", body.name.trim());
    if ("description" in body) push("description", String(body.description ?? "").trim() || null);
    if (body.min_score !== undefined) push("min_score", Math.max(0, Math.min(100, Number(body.min_score) || 0)));
    if ("band" in body) push("band", body.band && BANDS.includes(String(body.band)) ? String(body.band) : null);
    if (body.steps !== undefined) push("steps", JSON.stringify(cleanSteps(body.steps)));
    if (body.status === "active" || body.status === "paused") push("status", body.status);

    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    sets.push("updated_at = now()");

    const row = await one(`UPDATE outreach_sequences SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, vals);
    if (!row) return res.status(404).json({ error: "unknown sequence" });
    res.json(await one(`${SEQUENCE_SELECT} WHERE seq.id = $1`, [req.params.id]));
  }),
);

workspace.delete(
  "/api/sequences/:id",
  wrap(async (req, res) => {
    await q(`DELETE FROM outreach_sequences WHERE id=$1`, [req.params.id]);
    res.status(204).end();
  }),
);

/** Who the rule currently matches, and who is already in. */
workspace.get(
  "/api/sequences/:id/audience",
  wrap(async (req, res) => {
    const seq = await one<{ service_id: string; min_score: number; band: string | null }>(
      `SELECT service_id, min_score, band FROM outreach_sequences WHERE id=$1`,
      [req.params.id],
    );
    if (!seq) return res.status(404).json({ error: "unknown sequence" });

    res.json(
      await q(
        `SELECT c.id, c.name, c.domain, c.industry, ls.total, ls.band,
                (e.id IS NOT NULL AND e.status = 'enrolled') AS enrolled,
                e.enrolled_at,
                (SELECT count(*)::int FROM outreach_drafts od
                  WHERE od.company_id = c.id AND od.service_id = $1) AS drafts
           FROM lead_scores ls
           JOIN companies c ON c.id = ls.company_id
           LEFT JOIN sequence_enrollments e ON e.company_id = c.id AND e.sequence_id = $4
          WHERE ls.service_id = $1 AND NOT ls.disqualified
            AND ls.total >= $2 AND ($3::text IS NULL OR ls.band = $3)
          ORDER BY ls.total DESC
          LIMIT 200`,
        [seq.service_id, seq.min_score, seq.band, req.params.id],
      ),
    );
  }),
);

/** Pull every currently-matching company into the sequence. Idempotent. */
workspace.post(
  "/api/sequences/:id/enroll",
  wrap(async (req, res) => {
    const seq = await one<{ service_id: string; min_score: number; band: string | null }>(
      `SELECT service_id, min_score, band FROM outreach_sequences WHERE id=$1`,
      [req.params.id],
    );
    if (!seq) return res.status(404).json({ error: "unknown sequence" });

    const inserted = await q(
      `INSERT INTO sequence_enrollments (sequence_id, company_id)
       SELECT $1, ls.company_id FROM lead_scores ls
        WHERE ls.service_id = $2 AND NOT ls.disqualified
          AND ls.total >= $3 AND ($4::text IS NULL OR ls.band = $4)
       ON CONFLICT (sequence_id, company_id) DO UPDATE SET status = 'enrolled'
       RETURNING company_id`,
      [req.params.id, seq.service_id, seq.min_score, seq.band],
    );
    res.json({ enrolled: inserted.length, sequence: await one(`${SEQUENCE_SELECT} WHERE seq.id = $1`, [req.params.id]) });
  }),
);

workspace.delete(
  "/api/sequences/:id/enrollments/:companyId",
  wrap(async (req, res) => {
    await q(`UPDATE sequence_enrollments SET status='removed' WHERE sequence_id=$1 AND company_id=$2`, [
      req.params.id,
      req.params.companyId,
    ]);
    res.status(204).end();
  }),
);

/** Drafts written for companies in this sequence - the Activity tab. */
workspace.get(
  "/api/outreach/activity",
  wrap(async (req, res) => {
    const service = await resolveService(req.query.service);
    if (service === null) return res.status(404).json({ error: "unknown service" });
    res.json(
      await q(
        `SELECT od.id, od.channel, od.subject, od.body, od.created_at,
                c.id AS company_id, c.name AS company_name, c.domain,
                ls.total AS score, ls.band
           FROM outreach_drafts od
           JOIN companies c ON c.id = od.company_id
           LEFT JOIN lead_scores ls ON ls.company_id = c.id AND ls.service_id = od.service_id
          WHERE ($1::uuid IS NULL OR od.service_id = $1)
          ORDER BY od.created_at DESC
          LIMIT $2`,
        [service?.id ?? null, asInt(req.query.limit, 30, 200)],
      ),
    );
  }),
);

/* ------------------------------------------------------ report schedules */

workspace.get(
  "/api/report-schedules",
  wrap(async (_req, res) => {
    res.json(
      await q(`SELECT rs.*, s.key AS service_key, s.name AS service_name
                 FROM report_schedules rs LEFT JOIN services s ON s.id = rs.service_id
                ORDER BY rs.created_at DESC`),
    );
  }),
);

workspace.post(
  "/api/report-schedules",
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    const cadence = ["daily", "weekly", "monthly"].includes(String(req.body?.cadence))
      ? String(req.body.cadence)
      : "weekly";
    const service = req.body?.service ? await serviceByKey(String(req.body.service)) : null;

    const row = await one(
      `INSERT INTO report_schedules (service_id, name, cadence, recipients)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [service?.id ?? null, name, cadence, asStrArray(req.body?.recipients)],
    );
    res.status(201).json(
      await one(
        `SELECT rs.*, s.key AS service_key, s.name AS service_name
           FROM report_schedules rs LEFT JOIN services s ON s.id = rs.service_id WHERE rs.id=$1`,
        [(row as any).id],
      ),
    );
  }),
);

workspace.patch(
  "/api/report-schedules/:id",
  wrap(async (req, res) => {
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false" });
    const row = await one(`UPDATE report_schedules SET enabled=$2 WHERE id=$1 RETURNING *`, [
      req.params.id,
      req.body.enabled,
    ]);
    if (!row) return res.status(404).json({ error: "unknown schedule" });
    res.json(row);
  }),
);

workspace.delete(
  "/api/report-schedules/:id",
  wrap(async (req, res) => {
    await q(`DELETE FROM report_schedules WHERE id=$1`, [req.params.id]);
    res.status(204).end();
  }),
);

/* ------------------------------------------------------- members + settings */

workspace.get(
  "/api/members",
  wrap(async (_req, res) => {
    res.json(await q(`SELECT * FROM workspace_members ORDER BY role, name`));
  }),
);

workspace.post(
  "/api/members",
  wrap(async (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!name || !email) return res.status(400).json({ error: "name and email are required" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: `"${email}" is not an email address` });
    const role = ["owner", "admin", "member"].includes(String(req.body?.role)) ? String(req.body.role) : "member";

    const row = await one(
      `INSERT INTO workspace_members (name, email, role) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
       RETURNING *`,
      [name, email, role],
    );
    res.status(201).json(row);
  }),
);

workspace.patch(
  "/api/members/:id",
  wrap(async (req, res) => {
    if (!["owner", "admin", "member"].includes(String(req.body?.role))) {
      return res.status(400).json({ error: "role must be owner, admin or member" });
    }
    const row = await one(`UPDATE workspace_members SET role=$2 WHERE id=$1 RETURNING *`, [
      req.params.id,
      req.body.role,
    ]);
    if (!row) return res.status(404).json({ error: "unknown member" });
    res.json(row);
  }),
);

workspace.delete(
  "/api/members/:id",
  wrap(async (req, res) => {
    await q(`DELETE FROM workspace_members WHERE id=$1`, [req.params.id]);
    res.status(204).end();
  }),
);

workspace.get(
  "/api/settings",
  wrap(async (_req, res) => {
    res.json(await one(`SELECT * FROM workspace_settings WHERE id`));
  }),
);

workspace.put(
  "/api/settings",
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const row = await one(
      `UPDATE workspace_settings
          SET name=$1, slug=$2, timezone=$3, notifications=$4::jsonb, updated_at=now()
        WHERE id RETURNING *`,
      [
        name,
        String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "workspace",
        String(body.timezone ?? "UTC").trim() || "UTC",
        JSON.stringify(body.notifications ?? {}),
      ],
    );
    res.json(row);
  }),
);

/* ------------------------------------------------------------ model config */

/**
 * The model the sales team has connected. The API key itself never leaves the
 * server - the response carries only whether one is set and a four-character
 * hint, which is enough to tell two keys apart.
 */
workspace.get(
  "/api/llm",
  wrap(async (_req, res) => {
    res.json({ ...(await describeLlmConfig()), secret_is_managed: await secretIsManaged() });
  }),
);

workspace.put(
  "/api/llm",
  wrap(async (req, res) => {
    const body = req.body ?? {};
    try {
      await saveLlmConfig({
        base_url: body.base_url,
        model: body.model,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        extra_headers: body.extra_headers,
        // Absent means "leave the stored key alone"; an empty string clears it.
        api_key: body.api_key === undefined ? undefined : String(body.api_key),
      });
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
    res.json({ ...(await describeLlmConfig()), secret_is_managed: await secretIsManaged() });
  }),
);

/** Models the configured gateway reports, for the picker. */
workspace.get(
  "/api/llm/models",
  wrap(async (_req, res) => {
    try {
      res.json({ models: await listModels() });
    } catch (err) {
      const status = err instanceof LlmError ? err.status || 502 : 502;
      res.status(status).json({ error: (err as Error).message });
    }
  }),
);

/**
 * A real round trip with the saved credentials. An optional body lets the
 * dashboard test a key the operator has typed but not yet saved, so a bad key
 * is caught before it replaces a working one.
 */
workspace.post(
  "/api/llm/test",
  wrap(async (req, res) => {
    const body = req.body ?? {};
    try {
      const saved = await loadLlmConfig();
      const result = await testConnection({
        ...saved,
        baseUrl: body.base_url ? String(body.base_url).trim().replace(/\/+$/, "") : saved.baseUrl,
        model: body.model ? String(body.model).trim() : saved.model,
        apiKey: body.api_key ? String(body.api_key).trim() : saved.apiKey,
        extraHeaders: body.extra_headers === undefined ? saved.extraHeaders : cleanHeaders(body.extra_headers),
      });
      res.json(result);
    } catch (err) {
      const status = err instanceof LlmError ? err.status || 502 : 502;
      res.status(status === 401 || status === 403 ? 400 : status).json({ error: (err as Error).message });
    }
  }),
);

/**
 * Read-only view of how the server is configured. Secrets are reported as
 * present or absent, never echoed - the dashboard only needs to tell the
 * operator whether a key is wired up.
 */
workspace.get(
  "/api/runtime",
  wrap(async (_req, res) => {
    let dbHost = "unknown";
    try {
      dbHost = new URL(runtime.databaseUrl).host;
    } catch {
      /* a malformed URL is the operator's problem, not a reason to 500 here */
    }
    const llm = await describeLlmConfig();
    res.json({
      signal_model: llm.model,
      llm_base_url: llm.base_url,
      llm_key_set: llm.key_set,
      llm_key_source: llm.key_source,
      crawler_user_agent: runtime.userAgent,
      crawler_concurrency: runtime.concurrency,
      per_host_delay_ms: runtime.perHostDelayMs,
      respect_robots: runtime.respectRobots,
      api_port: runtime.apiPort,
      database_host: dbHost,
      crunchbase_key_set: Boolean(runtime.crunchbaseKey),
      newsapi_key_set: Boolean(runtime.newsApiKey),
      /** The default UA ships with a placeholder address; flag it rather than hide it. */
      user_agent_is_placeholder: runtime.userAgent.includes("change-me@example.com"),
    });
  }),
);
