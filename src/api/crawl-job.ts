/**
 * The crawl the dashboard can start.
 *
 * Crawling is minutes of work - robots.txt is obeyed, requests are serialised
 * per host and GDELT is spaced several seconds apart - so it cannot be an
 * ordinary request/response: the browser would time out long before the last
 * company was fetched. The button starts a job and returns immediately; the
 * screen then polls for progress.
 *
 * State is held in this process rather than the database because it describes
 * one run in flight, not a fact about the business. A server restart loses it,
 * which is correct - the run died with the process. What actually happened is
 * durable either way: every attempt is written to `crawl_log` as it goes.
 */
import { q } from "../db.js";
import { ingestCompany } from "../pipeline/ingest.js";
import type { Company } from "../types.js";

export interface CrawlProgress {
  status: "idle" | "running" | "done" | "failed";
  started_at: string | null;
  finished_at: string | null;
  /** How many companies the run covers. */
  total: number;
  /** How many have been attempted so far. */
  done: number;
  /** The company being fetched right now, for the progress line. */
  current: string | null;
  documents_added: number;
  results: Array<{ company: string; added: number; error: string | null }>;
  error: string | null;
}

const idle: CrawlProgress = {
  status: "idle",
  started_at: null,
  finished_at: null,
  total: 0,
  done: 0,
  current: null,
  documents_added: 0,
  results: [],
  error: null,
};

let job: CrawlProgress = { ...idle };

export const crawlStatus = (): CrawlProgress => job;
export const crawlIsRunning = (): boolean => job.status === "running";

/**
 * Starts a crawl and returns at once. Pass a company id to refresh a single
 * account; omit it to sweep every tracked company.
 *
 * Throws if one is already in flight - two concurrent crawls would fight over
 * the per-host rate limiter and get the project rate-limited or blocked.
 */
export async function startCrawl(companyId?: string): Promise<CrawlProgress> {
  if (crawlIsRunning()) throw new Error("A crawl is already running");

  const companies = companyId
    ? await q<Company>(`SELECT * FROM companies WHERE id=$1`, [companyId])
    : await q<Company>(`SELECT * FROM companies ORDER BY name`);

  if (!companies.length) {
    throw new Error(companyId ? "unknown company" : "No companies to crawl yet - add a prospect first");
  }

  job = {
    ...idle,
    status: "running",
    started_at: new Date().toISOString(),
    total: companies.length,
  };

  // Deliberately not awaited: the caller gets its response now and the work
  // continues. Every failure path below is caught, so this cannot reject and
  // take the process down with an unhandled rejection.
  void run(companies);

  return job;
}

async function run(companies: Company[]): Promise<void> {
  try {
    for (const company of companies) {
      job.current = company.name;
      try {
        const { added } = await ingestCompany(company.name, company.domain);
        const total = Object.values(added).reduce((sum, n) => sum + n, 0);
        job.documents_added += total;
        job.results.push({ company: company.name, added: total, error: null });
      } catch (err) {
        // One unreachable site must not end the sweep.
        job.results.push({ company: company.name, added: 0, error: (err as Error).message });
      }
      job.done++;
    }
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.error = (err as Error).message;
  } finally {
    job.current = null;
    job.finished_at = new Date().toISOString();
  }
}
