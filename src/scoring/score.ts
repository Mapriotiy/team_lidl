/**
 * Scoring. Deterministic, auditable, and independent of the LLM.
 *
 *   total = fitWeight * ICP fit  +  (1 - fitWeight) * intent  -  penalty
 *
 * intent  weighted share of positive signals confirmed, each decayed by the age of
 *         its evidence (a hiring push from two years ago is not a live signal)
 * penalty weighted negative signals, undecayed - a structural mismatch does not fade
 * fit     firmographic match against the Ideal Customer Profile
 *
 * Any disqualifier answered "yes" with real confidence zeroes the lead outright.
 * Every term is written into `breakdown`, which is what the dashboard renders as
 * "why this lead", so a rep can always see which sentence on which page moved the score.
 */
import { q, one } from "../db.js";
import type { Company, EvidenceRef, SignalQuestion, Verdict } from "../types.js";

const WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const DAY = 86_400_000;

export interface IcpProfile {
  id: string;
  service_id: string;
  name: string;
  countries: string[];
  industries: string[];
  min_employees: number | null;
  max_employees: number | null;
  exclude_industries: string[];
  fit_weight: string | number;
}

interface AnswerRow extends SignalQuestion {
  verdict: Verdict | null;
  confidence: string | number | null;
  rationale: string | null;
  evidence: EvidenceRef[] | null;
}

export interface ScoreBreakdownItem {
  key: string;
  question: string;
  polarity: string;
  weight: string;
  verdict: Verdict;
  confidence: number;
  recency: number;
  evidence_age_days: number | null;
  contribution: number;
  rationale: string | null;
  evidence: EvidenceRef[];
}

/** Firmographic fit, 0..1. Absent data scores neutral rather than zero. */
export function icpFit(company: Company, icp: IcpProfile | null): { score: number; detail: Record<string, unknown> } {
  if (!icp) return { score: 0.5, detail: { note: "no ICP configured - neutral fit" } };

  const detail: Record<string, unknown> = {};
  const parts: number[] = [];

  if (icp.countries.length) {
    const hit = company.country ? icp.countries.some((c) => c.toLowerCase() === company.country!.toLowerCase()) : null;
    detail.country = { value: company.country, target: icp.countries, match: hit };
    parts.push(hit === null ? 0.5 : hit ? 1 : 0);
  }

  if (icp.industries.length) {
    const industry = (company.industry ?? "").toLowerCase();
    const hit = industry ? icp.industries.some((i) => industry.includes(i.toLowerCase()) || i.toLowerCase().includes(industry)) : null;
    detail.industry = { value: company.industry, target: icp.industries, match: hit };
    parts.push(hit === null ? 0.5 : hit ? 1 : 0);
  }

  if (icp.min_employees !== null || icp.max_employees !== null) {
    const n = company.employee_count;
    let hit: boolean | null = null;
    if (n !== null) {
      hit = (icp.min_employees === null || n >= icp.min_employees) && (icp.max_employees === null || n <= icp.max_employees);
    }
    detail.employees = { value: n, min: icp.min_employees, max: icp.max_employees, match: hit };
    parts.push(hit === null ? 0.5 : hit ? 1 : 0);
  }

  const excluded = icp.exclude_industries.length > 0 && company.industry
    ? icp.exclude_industries.some((i) => company.industry!.toLowerCase().includes(i.toLowerCase()))
    : false;
  if (excluded) {
    detail.excluded_industry = company.industry;
    return { score: 0, detail };
  }

  const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;
  return { score, detail };
}

function newestEvidenceAge(evidence: EvidenceRef[]): number | null {
  const times = evidence
    .filter((e) => e.verified && e.published_at)
    .map((e) => new Date(e.published_at!).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!times.length) return null;
  return Math.max(0, (Date.now() - Math.max(...times)) / DAY);
}

export function band(total: number, disqualified: boolean): string {
  if (disqualified) return "disqualified";
  if (total >= 70) return "hot";
  if (total >= 45) return "warm";
  if (total >= 25) return "nurture";
  return "cold";
}

export async function scoreCompanyForService(company: Company, serviceId: string) {
  const rows = await q<AnswerRow>(
    `SELECT sq.*, sa.verdict, sa.confidence, sa.rationale, sa.evidence
       FROM signal_questions sq
       LEFT JOIN signal_answers sa ON sa.question_id = sq.id AND sa.company_id = $1
      WHERE sq.service_id = $2 AND sq.enabled
      ORDER BY sq.polarity, sq.key`,
    [company.id, serviceId],
  );
  if (!rows.length) return null;

  const icp = await one<IcpProfile>(`SELECT * FROM icp_profiles WHERE service_id=$1 LIMIT 1`, [serviceId]);
  const fitWeight = icp ? Number(icp.fit_weight) : 0.3;

  const positiveMax = rows.filter((r) => r.polarity === "positive").reduce((sum, r) => sum + (WEIGHT[r.weight] ?? 1), 0) || 1;

  let intentRaw = 0;
  let penaltyRaw = 0;
  let disqualified = false;
  const items: ScoreBreakdownItem[] = [];

  for (const r of rows) {
    const verdict: Verdict = r.verdict ?? "unknown";
    const confidence = Math.max(0, Math.min(1, Number(r.confidence ?? 0)));
    const evidence = (r.evidence ?? []).filter((e) => e.verified);
    const weight = WEIGHT[r.weight] ?? 1;

    const ageDays = newestEvidenceAge(r.evidence ?? []);
    // Undated evidence is treated as mildly stale rather than fresh or worthless.
    const recency = verdict === "yes" ? (ageDays === null ? 0.7 : Math.pow(0.5, ageDays / r.half_life_days)) : 0;

    let contribution = 0;
    if (verdict === "yes" && confidence > 0) {
      if (r.polarity === "positive") {
        contribution = weight * confidence * recency;
        intentRaw += contribution;
      } else if (r.polarity === "negative") {
        contribution = -(weight * confidence);
        penaltyRaw += weight * confidence;
      } else if (r.polarity === "disqualifier" && confidence >= 0.5) {
        disqualified = true;
      }
    }

    items.push({
      key: r.key,
      question: r.text,
      polarity: r.polarity,
      weight: r.weight,
      verdict,
      confidence: Number(confidence.toFixed(2)),
      recency: Number(recency.toFixed(3)),
      evidence_age_days: ageDays === null ? null : Math.round(ageDays),
      contribution: Number(contribution.toFixed(3)),
      rationale: r.rationale,
      evidence,
    });
  }

  const fit = icpFit(company, icp ?? null);
  const intent = (intentRaw / positiveMax) * 100;
  const penalty = (penaltyRaw / positiveMax) * 100;
  const rawTotal = fitWeight * fit.score * 100 + (1 - fitWeight) * intent - penalty;
  const total = disqualified ? 0 : Math.max(0, Math.min(100, rawTotal));

  const breakdown = {
    formula: "total = fit_weight * fit * 100 + (1 - fit_weight) * intent - penalty",
    fit_weight: fitWeight,
    icp: { name: icp?.name ?? null, score: Number(fit.score.toFixed(3)), detail: fit.detail },
    positive_weight_available: positiveMax,
    signals: items,
    top_reasons: items
      .filter((i) => i.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((i) => i.rationale ?? i.question),
  };

  await q(
    `INSERT INTO lead_scores (company_id, service_id, fit_score, intent_score, penalty, total, band, disqualified, breakdown)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (company_id, service_id) DO UPDATE SET
       fit_score=EXCLUDED.fit_score, intent_score=EXCLUDED.intent_score, penalty=EXCLUDED.penalty,
       total=EXCLUDED.total, band=EXCLUDED.band, disqualified=EXCLUDED.disqualified,
       breakdown=EXCLUDED.breakdown, computed_at=now()`,
    [
      company.id,
      serviceId,
      Number((fit.score * 100).toFixed(2)),
      Number(intent.toFixed(2)),
      Number(penalty.toFixed(2)),
      Number(total.toFixed(2)),
      band(total, disqualified),
      disqualified,
      JSON.stringify(breakdown),
    ],
  );

  return { total: Number(total.toFixed(2)), band: band(total, disqualified), disqualified, intent, fit: fit.score, breakdown };
}
