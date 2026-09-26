/**
 * Hiring signals - the highest-value and most reliable source in this platform.
 *
 * Key insight: almost nobody serves job posts from hand-built pages any more. They
 * embed an applicant tracking system, and every major ATS exposes a public, documented
 * JSON endpoint for its own job board. So we do NOT scrape careers pages: we detect
 * which ATS a company uses, then read the structured feed. That is faster, cleaner and
 * far more robust than HTML scraping, and it stays within each vendor's public API.
 *
 * Verified live against Greenhouse, Lever, Ashby and Workable.
 * Generic HTML crawling is only the fallback for the tail.
 */
import { politeFetch, fetchJson } from "../net/fetcher.js";
import { settings } from "../settings.js";
import { htmlToText, linksFrom, extractArticle } from "../net/extract.js";
import type { RawDoc } from "../types.js";

export type AtsProvider =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "smartrecruiters"
  | "recruitee"
  | "personio"
  | "teamtailor"
  | "workday";

export interface AtsHandle {
  provider: AtsProvider;
  slug: string;
}

/** Each pattern pulls the board slug straight out of any ATS URL found on the site. */
const PATTERNS: Array<{ provider: AtsProvider; re: RegExp }> = [
  { provider: "greenhouse", re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i },
  { provider: "lever", re: /jobs\.lever\.co\/([a-z0-9_-]+)/i },
  { provider: "ashby", re: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
  { provider: "workable", re: /apply\.workable\.com\/(?:embed\/)?([a-z0-9_-]+)/i },
  { provider: "smartrecruiters", re: /(?:careers|jobs)\.smartrecruiters\.com\/([a-z0-9_-]+)/i },
  { provider: "recruitee", re: /([a-z0-9_-]+)\.recruitee\.com/i },
  { provider: "personio", re: /([a-z0-9_-]+)\.jobs\.personio\.(?:de|com)/i },
  { provider: "teamtailor", re: /([a-z0-9_-]+)\.teamtailor\.com/i },
];

/** Workday needs three parts, so it gets its own matcher. Slug is `tenant|datacenter|board`. */
const WORKDAY_RE = /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:wday\/cxs\/[^/]+\/)?(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/i;

const CAREERS_PATHS = ["/careers", "/career", "/jobs", "/en/careers", "/company/careers", "/about/careers", "/join-us", "/work-with-us", "/vacancies"];

function matchProvider(haystack: string): AtsHandle | null {
  const wd = WORKDAY_RE.exec(haystack);
  if (wd && wd[1] && wd[2] && wd[3]) {
    return { provider: "workday", slug: `${wd[1]}|${wd[2]}|${wd[3]}` };
  }
  for (const { provider, re } of PATTERNS) {
    const m = re.exec(haystack);
    if (m && m[1] && m[1] !== "www" && m[1] !== "embed") {
      return { provider, slug: m[1] };
    }
  }
  return null;
}

/**
 * Slug probing: ask each ATS directly whether it hosts a board under a guessed name.
 *
 * This exists because scanning careers pages for a board URL fails on most modern
 * sites - measured on ten European companies, only one exposed its ATS in static HTML.
 * Probing the public APIs instead found a board for nine of eleven, with no browser.
 *
 * A 200 is not sufficient proof: Workable answers 200 with an empty job list for
 * accounts that do not exist. Neither is a single posting - `personio.recruitee.com` is a
 * vendor sandbox board whose one listing is "API Job - Berlin - Musterstr 1" from a company
 * called FD Sandbox, and matching it wrongly attributed that job to Personio. A real
 * corporate board of the size this platform targets carries several openings, so a probe
 * hit needs at least MIN_PROBE_POSTINGS of them. Smaller boards are still found by the
 * static pass, which reads the actual careers page and cannot collide.
 */
const MIN_PROBE_POSTINGS = 3;
const PROBES: Array<{ provider: AtsProvider; url: (slug: string) => string; count: (d: any) => number }> = [
  { provider: "greenhouse", url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`, count: (d) => (d?.jobs ?? []).length },
  { provider: "lever", url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`, count: (d) => (Array.isArray(d) ? d.length : 0) },
  { provider: "ashby", url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`, count: (d) => (d?.jobs ?? []).length },
  { provider: "workable", url: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`, count: (d) => (d?.jobs ?? []).length },
  { provider: "recruitee", url: (s) => `https://${s}.recruitee.com/api/offers/`, count: (d) => (d?.offers ?? []).length },
  { provider: "smartrecruiters", url: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=10`, count: (d) => (d?.content ?? []).length },
];

function candidateSlugs(companyName: string, domain: string): string[] {
  const label = domain.replace(/^www\./, "").split(".")[0] ?? "";
  const name = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const dashed = companyName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [...new Set([label, name, dashed].filter((s) => s.length > 1))];
}

export async function probeAts(companyName: string, domain: string): Promise<AtsHandle | null> {
  for (const slug of candidateSlugs(companyName, domain)) {
    const hits = await Promise.all(
      PROBES.map(async (p) => {
        const data = await fetchJson<any>(p.url(slug), { retries: 0, timeoutMs: 12000 });
        const n = data ? p.count(data) : 0;
        return n >= MIN_PROBE_POSTINGS ? { provider: p.provider, slug, n } : null;
      }),
    );
    const best = hits.filter(Boolean).sort((a, b) => b!.n - a!.n)[0];
    if (best) {
      console.log(`  ATS found by probing: ${best.provider}/${best.slug} (${best.n} postings)`);
      return { provider: best.provider, slug: best.slug };
    }
  }
  return null;
}

/**
 * Modern careers pages are client-rendered, so the ATS link is absent from the raw
 * HTML (verified: celonis.com serves a 17KB shell with no board URL in it). When the
 * static pass finds nothing we render the page once and look again.
 *
 * Playwright is an optional dependency. If it is not installed we degrade quietly
 * rather than failing the crawl:  npm i -D playwright && npx playwright install chromium
 */
async function renderPage(url: string): Promise<string | null> {
  const specifier = "playwright";
  let mod: any;
  try {
    mod = await import(specifier);
  } catch {
    return null;
  }
  let browser: any;
  try {
    browser = await mod.chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: settings.userAgent });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    return await page.content();
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Find the company's ATS by reading its homepage and careers pages and looking for
 * the tell-tale board URL. Returns the careers page we used so it can be stored.
 */
/**
 * Three passes, cheapest and most authoritative first:
 *   1. read the homepage and careers pages for a board URL  - no false positives
 *   2. probe the ATS APIs with slugs guessed from the domain - keyless, high hit rate
 *   3. render a careers page with Playwright and look again  - needs a browser
 */
export async function detectAts(domain: string, companyName?: string): Promise<{ handle: AtsHandle | null; careersUrl: string | null }> {
  const origin = domain.startsWith("http") ? domain : "https://" + domain;
  const tried = new Set<string>();
  const queue: string[] = [origin, ...CAREERS_PATHS.map((p) => origin + p)];
  const careersSeen: string[] = [];

  for (const url of queue) {
    if (tried.has(url)) continue;
    tried.add(url);

    const html = await politeFetch(url);
    if (!html) continue;
    if (url !== origin) careersSeen.push(url);

    const handle = matchProvider(html);
    if (handle) return { handle, careersUrl: url };

    // Homepage rarely embeds the board directly; follow its careers links once.
    if (url === origin) {
      for (const link of linksFrom(html, url)) {
        if (/care|job|vacan|join|hiring/i.test(link) && !tried.has(link) && queue.length < 14) {
          queue.push(link);
        }
      }
    }
  }

  // Pass 2: ask the ATS APIs directly. Domain-derived slug is tried first because it
  // is the least likely to collide with another company of a similar name.
  const probed = await probeAts(companyName ?? domain.split(".")[0] ?? domain, domain);
  if (probed) return { handle: probed, careersUrl: careersSeen[0] ?? null };

  // Pass 3: render the most likely careers pages and look again.
  for (const url of careersSeen.slice(0, 2)) {
    const rendered = await renderPage(url);
    if (!rendered) break; // Playwright unavailable - no point trying the second page.
    const handle = matchProvider(rendered);
    if (handle) {
      console.log(`  ATS found only after rendering ${url}`);
      return { handle, careersUrl: url };
    }
  }

  return { handle: null, careersUrl: careersSeen[0] ?? null };
}

const jobDoc = (url: string, title: string, body: string, published: Date | null, provider: string, meta: Record<string, unknown> = {}): RawDoc => ({
  sourceKind: "jobs",
  sourceName: provider,
  url,
  title,
  publishedAt: published,
  content: `JOB POSTING: ${title}\n\n${body}`.slice(0, 20000),
  meta,
});

export async function fetchJobs(handle: AtsHandle, limit = 60): Promise<RawDoc[]> {
  const { provider, slug } = handle;
  const docs: RawDoc[] = [];

  try {
    if (provider === "greenhouse") {
      const data = await fetchJson<any>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      for (const j of (data?.jobs ?? []).slice(0, limit)) {
        const body = htmlToText(decodeEntities(j.content ?? ""));
        docs.push(jobDoc(j.absolute_url, j.title, body, safeDate(j.updated_at), provider, { location: j.location?.name }));
      }
    } else if (provider === "lever") {
      const data = await fetchJson<any[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      for (const j of (data ?? []).slice(0, limit)) {
        const extra = (j.lists ?? []).map((l: any) => `${l.text}\n${htmlToText(l.content ?? "")}`).join("\n\n");
        const body = [j.descriptionPlain ?? htmlToText(j.description ?? ""), extra, j.additionalPlain ?? ""].filter(Boolean).join("\n\n");
        docs.push(jobDoc(j.hostedUrl, j.text, body, j.createdAt ? new Date(j.createdAt) : null, provider, { location: j.categories?.location, team: j.categories?.team }));
      }
    } else if (provider === "ashby") {
      const data = await fetchJson<any>(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
      for (const j of (data?.jobs ?? []).slice(0, limit)) {
        const body = j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? "");
        docs.push(jobDoc(j.jobUrl ?? j.applyUrl ?? "", j.title, body, safeDate(j.publishedAt), provider, { location: j.location, team: j.department }));
      }
    } else if (provider === "workable") {
      const data = await fetchJson<any>(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
      for (const j of (data?.jobs ?? []).slice(0, limit)) {
        const body = htmlToText([j.description, j.requirements, j.benefits].filter(Boolean).join("\n"));
        docs.push(jobDoc(j.url ?? j.application_url ?? "", j.title, body, safeDate(j.published_on ?? j.created_at), provider, { location: [j.city, j.country].filter(Boolean).join(", ") }));
      }
    } else if (provider === "smartrecruiters") {
      const list = await fetchJson<any>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${Math.min(limit, 100)}`);
      for (const p of (list?.content ?? []).slice(0, limit)) {
        const detail = await fetchJson<any>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${p.id}`);
        const sections = detail?.jobAd?.sections ?? {};
        const body = htmlToText([sections.companyDescription?.text, sections.jobDescription?.text, sections.qualifications?.text].filter(Boolean).join("\n"));
        docs.push(jobDoc(p.ref ?? p.applyUrl ?? "", p.name, body || p.name, safeDate(p.releasedDate), provider, { location: p.location?.city }));
      }
    } else if (provider === "recruitee") {
      const data = await fetchJson<any>(`https://${slug}.recruitee.com/api/offers/`);
      for (const o of (data?.offers ?? []).slice(0, limit)) {
        const body = htmlToText([o.description, o.requirements].filter(Boolean).join("\n"));
        docs.push(jobDoc(o.careers_url ?? o.careers_apply_url ?? "", o.title, body, safeDate(o.published_at ?? o.created_at), provider, { location: o.location }));
      }
    } else if (provider === "personio") {
      const xml = await politeFetch(`https://${slug}.jobs.personio.de/xml`, { accept: "application/xml", skipRobots: true });
      if (xml) {
        const { XMLParser } = await import("fast-xml-parser");
        const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
        const positions = toArray(parsed?.["workzag-jobs"]?.position ?? parsed?.positions?.position);
        for (const p of positions.slice(0, limit)) {
          const body = htmlToText(toArray(p.jobDescriptions?.jobDescription).map((d: any) => `${d?.name ?? ""}\n${d?.value ?? ""}`).join("\n"));
          docs.push(jobDoc(`https://${slug}.jobs.personio.de/job/${p.id}`, String(p.name ?? ""), body, safeDate(p.createdAt), provider, { location: p.office }));
        }
      }
    } else if (provider === "workday") {
      // Workday's CXS endpoint is POST-only and powers its own public job board.
      const [tenant, dc, board] = slug.split("|");
      const base = `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${board}`;
      const list = await fetchJson<any>(`${base}/jobs`, { body: { appliedFacets: {}, limit: Math.min(limit, 20), offset: 0, searchText: "" } });
      for (const p of (list?.jobPostings ?? []).slice(0, limit)) {
        const detail = await fetchJson<any>(base + p.externalPath);
        const info = detail?.jobPostingInfo ?? {};
        const body = htmlToText(info.jobDescription ?? "") || String(p.bulletFields ?? "");
        docs.push(
          jobDoc(
            info.externalUrl ?? `https://${tenant}.${dc}.myworkdayjobs.com/en-US/${board}${p.externalPath}`,
            p.title,
            body,
            safeDate(info.startDate ?? p.postedOn),
            provider,
            { location: p.locationsText ?? info.location },
          ),
        );
      }
    } else if (provider === "teamtailor") {
      // No open posting API - fall back to reading the public board.
      docs.push(...(await scrapeCareersHtml(`https://${slug}.teamtailor.com/jobs`, limit)));
    }
  } catch (err) {
    console.warn(`  ATS fetch failed for ${provider}/${slug}: ${(err as Error).message}`);
  }

  return docs.filter((d) => d.url && d.content.length > 40);
}

/** Last-resort scraper for companies with a hand-rolled careers page. */
export async function scrapeCareersHtml(careersUrl: string, limit = 25): Promise<RawDoc[]> {
  const html = await politeFetch(careersUrl);
  if (!html) return [];

  const jobLinks = linksFrom(html, careersUrl)
    .filter((u) => /\/(job|jobs|position|vacancy|vacancies|opening|careers)\/[^/]+/i.test(u))
    .slice(0, limit);

  const docs: RawDoc[] = [];
  for (const link of jobLinks) {
    const page = await politeFetch(link);
    if (!page) continue;
    const art = extractArticle(page);
    if (art.text.length < 200) continue;
    docs.push(jobDoc(link, art.title ?? "Job posting", art.text, art.publishedAt, "careers_html"));
  }
  return docs;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
