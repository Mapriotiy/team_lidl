/**
 * Outreach drafting. Grounded strictly in the verified evidence behind the score,
 * so the message references something the company actually published rather than a
 * generic pitch. If a claim is not in the breakdown, it does not go in the email.
 */
import { z } from "zod";
import { q, one } from "../db.js";
import { chatJson } from "../llm/client.js";
import type { Company } from "../types.js";

const DraftSchema = z.object({
  subject: z.string().describe("Email subject line, under 60 characters, no exclamation marks"),
  email_body: z.string().describe("Under 130 words. Plain text. Opens with the specific observed signal."),
  linkedin_message: z.string().describe("Under 60 words, suitable for an InMail or connection note"),
  value_proposition: z.string().describe("One sentence mapping our service to this company's specific situation"),
  talking_points: z.array(z.string()).describe("Three short bullets a rep can use on a call"),
  evidence_used: z.array(z.string()).describe("The URLs of the evidence this message relies on"),
});

const SYSTEM = `You write first-touch B2B sales outreach for Orange Systems, an IT and digital transformation services company.

You are given one prospect, the service being sold, and the verified public signals that made them a lead. Each signal carries a quote and a source URL.

Rules:
- Open with the specific thing the company did or said. Quote or paraphrase the actual signal. Never open with "I hope this finds you well" or "I came across your company".
- Every factual claim about the prospect must trace to a supplied signal. If the signals are thin, write a shorter and more tentative message rather than inventing detail.
- No flattery, no hype, no invented metrics or case-study numbers, no fake urgency.
- Respectful and direct. Assume the reader is a busy senior operator who will give it eight seconds.
- Close with one low-friction ask, not a hard sell.`;

export async function draftOutreach(company: Company, serviceKey: string, channel = "email") {
  const service = await one<{ id: string; name: string; value_prop: string | null }>(
    `SELECT id, name, value_prop FROM services WHERE key=$1`,
    [serviceKey],
  );
  if (!service) throw new Error(`unknown service: ${serviceKey}`);

  const score = await one<any>(`SELECT * FROM lead_scores WHERE company_id=$1 AND service_id=$2`, [company.id, service.id]);
  if (!score) throw new Error(`${company.name} has not been scored for ${serviceKey} yet`);

  const signals = (score.breakdown?.signals ?? [])
    .filter((s: any) => s.verdict === "yes" && s.evidence?.length)
    .map((s: any) => {
      const quotes = s.evidence.map((e: any) => `  - "${e.quote}" (${e.url}${e.published_at ? ", " + e.published_at.slice(0, 10) : ""})`).join("\n");
      return `SIGNAL: ${s.question}\nwhat we found: ${s.rationale}\nevidence:\n${quotes}`;
    })
    .join("\n\n");

  if (!signals) throw new Error(`${company.name} has no verified positive signals to write from`);

  const brief =
    `Prospect: ${company.name} (${company.domain})\n` +
    `Industry: ${company.industry ?? "unknown"} | Country: ${company.country ?? "unknown"} | Employees: ${company.employee_count ?? "unknown"}\n` +
    `Lead score: ${score.total}/100 (${score.band})\n\n` +
    `Service being sold: ${service.name}\n${service.value_prop ?? ""}\n\n` +
    `Verified signals:\n\n${signals}\n\n` +
    `Write the ${channel} draft.`;

  const { data: draft } = await chatJson({
    system: SYSTEM,
    user: brief,
    schema: DraftSchema,
    schemaName: "outreach_draft",
    maxTokens: 4000,
  });

  await q(
    `INSERT INTO outreach_drafts (company_id, service_id, channel, subject, body) VALUES ($1,$2,$3,$4,$5)`,
    [company.id, service.id, channel, draft.subject, draft.email_body],
  );

  return draft;
}
