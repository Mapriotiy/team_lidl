/**
 * Ingestion: run every source adapter for one company, normalise the output and
 * store it. Deduplication is by content hash, so re-running the pipeline daily
 * only adds genuinely new material and never re-pays for unchanged pages.
 */
import { createHash } from "node:crypto";
import { q, one } from "../db.js";
import { detectAts, fetchJobs, scrapeCareersHtml } from "../sources/ats.js";
import { fetchNews } from "../sources/news.js";
import { fetchWebsite } from "../sources/website.js";
import { resolveFirmographics } from "../sources/firmographics.js";
import type { Company, RawDoc } from "../types.js";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function upsertCompany(name: string, domain: string): Promise<Company> {
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const row = await one<Company>(
    `INSERT INTO companies (name, domain) VALUES ($1, $2)
     ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING *`,
    [name, clean],
  );
  return row!;
}

async function log(companyId: string, source: string, url: string, status: string, detail: string | null, added: number) {
  await q(
    `INSERT INTO crawl_log (company_id, source_name, url, status, detail, docs_added) VALUES ($1,$2,$3,$4,$5,$6)`,
    [companyId, source, url, status, detail, added],
  );
}

async function store(companyId: string, docs: RawDoc[]): Promise<number> {
  let added = 0;
  for (const d of docs) {
    if (!d.content || d.content.trim().length < 60) continue;
    const res = await q(
      `INSERT INTO documents (company_id, source_kind, source_name, url, title, published_at, lang, content, content_hash, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (company_id, content_hash) DO NOTHING
       RETURNING id`,
      [
        companyId,
        d.sourceKind,
        d.sourceName,
        d.url,
        d.title ?? null,
        d.publishedAt ?? null,
        d.lang ?? null,
        d.content,
        hash(d.content),
        JSON.stringify(d.meta ?? {}),
      ],
    );
    if (res.length) added++;
  }
  return added;
}

export interface IngestOpts {
  timespan?: string;
  maxWebsitePages?: number;
  maxJobs?: number;
  maxNews?: number;
}

/**
 * Which adapters the dashboard currently allows. A missing table means an older
 * schema, in which case everything runs - a source is never silently skipped
 * because of a migration the operator has not applied yet.
 */
async function enabledSources(): Promise<Set<string>> {
  try {
    const rows = await q<{ source_kind: string }>(`SELECT source_kind FROM source_settings WHERE enabled`);
    return new Set(rows.map((r) => r.source_kind));
  } catch {
    return new Set(["firmographics", "jobs", "news", "website"]);
  }
}

export async function ingestCompany(name: string, domain: string, opts: IngestOpts = {}): Promise<{ company: Company; added: Record<string, number> }> {
  const company = await upsertCompany(name, domain);
  const added: Record<string, number> = { firmographics: 0, jobs: 0, news: 0, website: 0 };
  const on = await enabledSources();
  console.log(`\n=== ${company.name} (${company.domain}) ===`);
  const off = ["firmographics", "jobs", "news", "website"].filter((k) => !on.has(k));
  if (off.length) console.log(`  (skipping ${off.join(", ")} - switched off in Data sources)`);

  // 1. Firmographics - needed for ICP fit, and gives us the canonical company name.
  if (on.has("firmographics")) {
    try {
      const firm = await resolveFirmographics(company.name, company.domain);
      await q(
        `UPDATE companies SET
           country = COALESCE($2, country), industry = COALESCE($3, industry),
           employee_count = COALESCE($4, employee_count), revenue_band = COALESCE($5, revenue_band),
           hq_city = COALESCE($6, hq_city), founded_year = COALESCE($7, founded_year),
           description = COALESCE($8, description),
           external_ids = companies.external_ids || $9::jsonb, updated_at = now()
         WHERE id = $1`,
        [
          company.id,
          firm.country ?? null,
          firm.industry ?? null,
          firm.employee_count ?? null,
          firm.revenue_band ?? null,
          firm.hq_city ?? null,
          firm.founded_year ?? null,
          firm.description ?? null,
          JSON.stringify(firm.external_ids ?? {}),
        ],
      );
      if (firm.description) {
        added.firmographics = await store(company.id, [{
          sourceKind: "firmographics",
          sourceName: firm.source,
          url: `https://${company.domain}`,
          title: `${company.name} - company profile`,
          content: `COMPANY PROFILE\nName: ${firm.name ?? company.name}\nCountry: ${firm.country ?? "unknown"}\nIndustry: ${firm.industry ?? "unknown"}\nEmployees: ${firm.employee_count ?? "unknown"}\nFounded: ${firm.founded_year ?? "unknown"}\n\n${firm.description}`,
          publishedAt: null,
        }]);
      }
      console.log(`  firmographics via ${firm.source}: ${firm.country ?? "?"} / ${firm.industry ?? "?"} / ${firm.employee_count ?? "?"} staff`);
    } catch (err) {
      await log(company.id, "firmographics", company.domain, "error", (err as Error).message, 0);
    }
  }

  // 2. Hiring signals via the company's ATS.
  if (on.has("jobs")) {
    try {
      const { handle, careersUrl } = await detectAts(company.domain, company.name);
      if (handle) {
        await q(`UPDATE companies SET ats_provider=$2, ats_slug=$3, careers_url=$4 WHERE id=$1`, [company.id, handle.provider, handle.slug, careersUrl]);
        const jobs = await fetchJobs(handle, opts.maxJobs ?? 60);
        added.jobs = await store(company.id, jobs);
        console.log(`  jobs: ${handle.provider}/${handle.slug} -> ${jobs.length} postings, ${added.jobs} new`);
        await log(company.id, handle.provider, careersUrl ?? "", "ok", `${jobs.length} postings`, added.jobs);
      } else if (careersUrl) {
        const jobs = await scrapeCareersHtml(careersUrl, opts.maxJobs ?? 25);
        added.jobs = await store(company.id, jobs);
        console.log(`  jobs: no ATS detected, scraped ${jobs.length} from ${careersUrl}`);
      } else {
        console.log("  jobs: no careers page found");
        await log(company.id, "ats", company.domain, "not_found", "no ATS or careers page", 0);
      }
    } catch (err) {
      await log(company.id, "ats", company.domain, "error", (err as Error).message, 0);
    }
  }

  // 3. News.
  if (on.has("news")) {
    try {
      const news = await fetchNews(company.name, { timespan: opts.timespan ?? "3m", maxArticles: opts.maxNews ?? 20 });
      added.news = await store(company.id, news);
      console.log(`  news: ${news.length} articles, ${added.news} new`);
      await log(company.id, "news", "gdelt+google_news", "ok", `${news.length} articles`, added.news);
    } catch (err) {
      await log(company.id, "news", "news", "error", (err as Error).message, 0);
    }
  }

  // 4. Owned pages: newsroom, strategy, about.
  if (on.has("website")) {
    try {
      const pages = await fetchWebsite(company.domain, opts.maxWebsitePages ?? 22);
      added.website = await store(company.id, pages);
      console.log(`  website: ${pages.length} pages, ${added.website} new`);
      await log(company.id, "website", company.domain, "ok", `${pages.length} pages`, added.website);
    } catch (err) {
      await log(company.id, "website", company.domain, "error", (err as Error).message, 0);
    }
  }

  const total = Object.values(added).reduce((a, b) => a + b, 0);
  console.log(`  -> ${total} new documents stored`);
  return { company: (await one<Company>(`SELECT * FROM companies WHERE id=$1`, [company.id]))!, added };
}
