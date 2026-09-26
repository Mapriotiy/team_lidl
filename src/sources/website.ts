/**
 * Company-owned pages: newsroom, press releases, strategy and annual-report pages,
 * "about" and technology pages. These carry the transformation / efficiency /
 * automation language the signal questions ask about.
 *
 * Sitemap-first, not a blind crawl. robots.txt advertises the sitemap, the sitemap
 * lists every page with a lastmod date, so we can pick the relevant recent pages
 * directly instead of walking the whole site.
 */
import { XMLParser } from "fast-xml-parser";
import { politeFetch, isAllowed } from "../net/fetcher.js";
import { extractArticle, linksFrom } from "../net/extract.js";
import type { RawDoc } from "../types.js";

const xml = new XMLParser({ ignoreAttributes: false });

/** Pages worth reading for buying signals. */
const RELEVANT = /(news|press|media|blog|insight|article|stor(y|ies)|about|company|investor|annual|report|strategy|sustainab|case-stud|customer|technolog|innovation|digital|transform|automation|security)/i;

/** Conventional corporate page locations, tried when discovery finds nothing. */
const CORPORATE_PATHS = [
  "/about", "/about-us", "/company", "/company/about", "/en/about",
  "/news", "/newsroom", "/press", "/media", "/blog", "/investors",
  "/en/news", "/en/press", "/corporate", "/sustainability", "/technology",
];

/** Pages that are never worth an LLM call. */
const NOISE = /(privacy|cookie|terms|legal|imprint|impressum|login|signup|cart|checkout|\.pdf$|\.jpg$|\.png$|\.zip$|\/tag\/|\/author\/|\/feed)/i;

async function sitemapsFromRobots(origin: string): Promise<string[]> {
  const txt = await politeFetch(origin + "/robots.txt", { accept: "text/plain", skipRobots: true, retries: 1 });
  const found: string[] = [];
  if (txt) {
    for (const line of txt.split(/\r?\n/)) {
      const m = /^sitemap:\s*(\S+)/i.exec(line.trim());
      if (m && m[1]) found.push(m[1]);
    }
  }
  if (!found.length) {
    found.push(origin + "/sitemap.xml", origin + "/sitemap_index.xml", origin + "/sitemap-index.xml", origin + "/sitemap/sitemap.xml");
  }
  return found;
}

interface SitemapEntry {
  url: string;
  lastmod: Date | null;
}

async function readSitemap(url: string, depth = 0, budget = { n: 0 }): Promise<SitemapEntry[]> {
  if (depth > 2 || budget.n > 12) return [];
  budget.n++;

  const body = await politeFetch(url, { accept: "application/xml,text/xml", retries: 1, timeoutMs: 20000 });
  if (!body) return [];

  // Several sites answer /sitemap.xml with an HTML page or a rate-limit interstitial at
  // HTTP 200 (measured on docplanner.com and personio.de). Parsing that yields silent junk.
  const head = body.trimStart().slice(0, 200).toLowerCase();
  if (!head.startsWith("<?xml") && !head.startsWith("<urlset") && !head.startsWith("<sitemapindex")) return [];

  let parsed: any;
  try {
    parsed = xml.parse(body);
  } catch {
    return [];
  }

  // A sitemap index points at further sitemaps; recurse into the promising ones.
  const indexNodes = toArray(parsed?.sitemapindex?.sitemap);
  if (indexNodes.length) {
    const children = indexNodes
      .map((s: any) => String(s.loc ?? ""))
      .filter(Boolean)
      .sort((a, b) => Number(RELEVANT.test(b)) - Number(RELEVANT.test(a)))
      .slice(0, 5);
    const nested = await Promise.all(children.map((c) => readSitemap(c, depth + 1, budget)));
    return nested.flat();
  }

  return toArray(parsed?.urlset?.url)
    .map((u: any) => ({
      url: String(u.loc ?? ""),
      lastmod: u.lastmod ? new Date(String(u.lastmod)) : null,
    }))
    .filter((e: SitemapEntry) => e.url);
}

export async function fetchWebsite(domain: string, maxPages = 22): Promise<RawDoc[]> {
  const origin = domain.startsWith("http") ? domain.replace(/\/$/, "") : "https://" + domain;

  let candidates: SitemapEntry[] = [];
  for (const sm of await sitemapsFromRobots(origin)) {
    candidates.push(...(await readSitemap(sm)));
    if (candidates.length > 4000) break;
  }

  // No usable sitemap: fall back to one hop out from the homepage.
  if (candidates.length < 3) {
    const home = await politeFetch(origin);
    if (home) {
      candidates = linksFrom(home, origin)
        .filter((u) => new URL(u).hostname.endsWith(new URL(origin).hostname.replace(/^www\./, "")))
        .map((u) => ({ url: u, lastmod: null }));
    }
  }

  let ranked = candidates
    .filter((e) => RELEVANT.test(e.url) && !NOISE.test(e.url))
    .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0))
    .slice(0, maxPages * 2);

  // Last resort: no usable sitemap and a homepage with no corporate links on it. This is
  // normal for storefronts (trendyol.com) and JS-rendered marketing sites (docplanner.com),
  // where the newsroom exists but nothing on the landing page points at it. Try the
  // conventional locations directly; misses simply 404 and cost one request each.
  if (!ranked.length) {
    ranked = CORPORATE_PATHS.map((p) => ({ url: origin + p, lastmod: null }));
  }

  const seen = new Set<string>();
  const docs: RawDoc[] = [];
  for (const entry of ranked) {
    if (docs.length >= maxPages) break;
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);

    if (!(await isAllowed(entry.url))) continue;
    const html = await politeFetch(entry.url, { retries: 1 });
    if (!html) continue;

    const art = extractArticle(html);
    if (art.text.length < 350) continue;

    docs.push({
      sourceKind: "website",
      sourceName: "website",
      url: entry.url,
      title: art.title ?? entry.url,
      publishedAt: art.publishedAt ?? entry.lastmod ?? null,
      lang: art.lang ?? undefined,
      content: art.text.slice(0, 15000),
      meta: { lastmod: entry.lastmod?.toISOString() ?? null },
    });
  }
  return docs;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
