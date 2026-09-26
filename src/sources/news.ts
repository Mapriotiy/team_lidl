/**
 * News signals: acquisitions, funding, leadership changes, incidents, expansion.
 *
 * Two keyless sources run by default:
 *   GDELT       - global, 65+ languages, returns direct publisher URLs so we can fetch
 *                 the article body. Hard rate limit of one request per 5 seconds,
 *                 enforced below (measured: it returns HTTP 429 with a plain-text
 *                 warning, not JSON, if you go faster).
 *   Google News - RSS, no key, excellent recall on headlines. Item links are consent
 *                 redirects, so these are stored as headline-level evidence.
 *
 * NewsAPI is used only when NEWSAPI_KEY is set.
 */
import { XMLParser } from "fast-xml-parser";
import { politeFetch, fetchJson } from "../net/fetcher.js";
import { extractArticle, parseDate } from "../net/extract.js";
import { settings } from "../settings.js";
import type { RawDoc } from "../types.js";

const GDELT_MIN_GAP_MS = 6500;
let gdeltChain: Promise<void> = Promise.resolve();

/** Serialise every GDELT call and space them out; the API is strict about this. */
function gdeltSlot<T>(fn: () => Promise<T>): Promise<T> {
  const result = gdeltChain.then(fn);
  gdeltChain = result.then(
    () => new Promise((r) => setTimeout(r, GDELT_MIN_GAP_MS)),
    () => new Promise((r) => setTimeout(r, GDELT_MIN_GAP_MS)),
  );
  return result;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });

export interface NewsOpts {
  /** How far back to look. GDELT accepts 1d / 1w / 1m / 6m style spans. */
  timespan?: string;
  maxArticles?: number;
  /** Fetch the publisher page for each GDELT hit instead of storing the headline only. */
  fetchBodies?: boolean;
}

export async function fetchGdelt(companyName: string, opts: NewsOpts = {}): Promise<RawDoc[]> {
  const { timespan = "3m", maxArticles = 20, fetchBodies = true } = opts;
  const query = encodeURIComponent(`"${companyName}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=${Math.min(maxArticles * 2, 250)}&timespan=${timespan}&sort=datedesc`;

  // GDELT signals throttling with a plain-text body and HTTP 200, so parsing must be
  // done by hand. Without this check a rate-limited run looks identical to "no news",
  // which silently produces under-scored leads.
  const raw = await gdeltSlot(() => politeFetch(url, { accept: "application/json", skipRobots: true, retries: 2 }));
  if (!raw) {
    console.warn("  GDELT: request failed, falling back to other news sources");
    return [];
  }
  const head = raw.trimStart();
  if (!head.startsWith("{")) {
    console.warn(`  GDELT: throttled or rejected - "${head.slice(0, 80).replace(/\s+/g, " ")}"`);
    return [];
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("  GDELT: unparseable response");
    return [];
  }

  const articles: any[] = data?.articles ?? [];
  if (!articles.length) return [];

  const seenDomains = new Map<string, number>();
  const picked: any[] = [];
  for (const a of articles) {
    // Cap any one outlet so a single syndicating site cannot dominate the evidence.
    const n = seenDomains.get(a.domain) ?? 0;
    if (n >= 2) continue;
    seenDomains.set(a.domain, n + 1);
    picked.push(a);
    if (picked.length >= maxArticles) break;
  }

  const docs: RawDoc[] = [];
  for (const a of picked) {
    const published = parseDate(a.seendate);
    let body = "";
    if (fetchBodies) {
      const html = await politeFetch(a.url, { retries: 1, timeoutMs: 15000 });
      if (html) body = extractArticle(html).text.slice(0, 12000);
    }
    docs.push({
      sourceKind: "news",
      sourceName: "gdelt",
      url: a.url,
      title: a.title,
      publishedAt: published,
      lang: a.language,
      content: body.length > 300 ? `${a.title}\n\n${body}` : `NEWS HEADLINE: ${a.title}\nOutlet: ${a.domain}`,
      meta: { outlet: a.domain, country: a.sourcecountry, headlineOnly: body.length <= 300 },
    });
  }
  return docs;
}

export async function fetchGoogleNews(companyName: string, opts: NewsOpts = {}): Promise<RawDoc[]> {
  const { timespan = "3m", maxArticles = 20 } = opts;
  const days = /^(\d+)m$/.test(timespan) ? Number(RegExp.$1) * 30 : 180;
  const q = encodeURIComponent(`"${companyName}" when:${days}d`);
  const feed = await politeFetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, {
    accept: "application/rss+xml,application/xml",
    skipRobots: true,
  });
  if (!feed) return [];

  const items = toArray(xml.parse(feed)?.rss?.channel?.item).slice(0, maxArticles);
  return items.map((it: any) => ({
    sourceKind: "news" as const,
    sourceName: "google_news",
    url: String(it.link ?? ""),
    title: String(it.title ?? ""),
    publishedAt: parseDate(it.pubDate),
    content: `NEWS HEADLINE: ${it.title}\nOutlet: ${it.source?.["#text"] ?? it.source ?? "unknown"}`,
    meta: { outlet: it.source?.["#text"] ?? null, headlineOnly: true },
  })).filter((d) => d.url);
}

export async function fetchNewsApi(companyName: string, opts: NewsOpts = {}): Promise<RawDoc[]> {
  if (!settings.newsApiKey) return [];
  const { maxArticles = 20 } = opts;
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(`"${companyName}"`)}&from=${from}&sortBy=publishedAt&pageSize=${maxArticles}&language=en&apiKey=${settings.newsApiKey}`;
  const data = await fetchJson<any>(url);
  return (data?.articles ?? []).map((a: any) => ({
    sourceKind: "news" as const,
    sourceName: "newsapi",
    url: a.url,
    title: a.title,
    publishedAt: parseDate(a.publishedAt),
    content: [a.title, a.description, a.content].filter(Boolean).join("\n\n"),
    meta: { outlet: a.source?.name },
  }));
}

export async function fetchNews(companyName: string, opts: NewsOpts = {}): Promise<RawDoc[]> {
  const batches = await Promise.all([
    fetchGdelt(companyName, opts).catch(() => []),
    fetchGoogleNews(companyName, opts).catch(() => []),
    fetchNewsApi(companyName, opts).catch(() => []),
  ]);

  // Deduplicate across providers on normalised title.
  const seen = new Set<string>();
  const out: RawDoc[] = [];
  for (const doc of batches.flat()) {
    const key = (doc.title ?? doc.url).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60);
    if (key && seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
