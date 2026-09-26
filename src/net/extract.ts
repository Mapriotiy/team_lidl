/**
 * Turns raw HTML into the clean article text the LLM will read.
 * Kept dependency-light on purpose: strip chrome, score candidate containers,
 * take the densest one. Good enough for newsrooms, press releases and job pages.
 */
import * as cheerio from "cheerio";

const CHROME = "script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,figure figcaption,.cookie,.cookie-banner,#cookie,.newsletter,.breadcrumb,.sidebar,.menu,.social-share";

export interface Article {
  title: string | null;
  text: string;
  publishedAt: Date | null;
  lang: string | null;
}

function clean(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  // GDELT style: 20260921T143000Z
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim());
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return null;
}

/** Convert an HTML fragment (job descriptions arrive this way) to readable text. */
export function htmlToText(fragment: string): string {
  if (!fragment) return "";
  const $ = cheerio.load(fragment);
  $("script,style").remove();
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("- ");
  });
  $("p,div,li,h1,h2,h3,h4,tr").each((_, el) => {
    $(el).append("\n");
  });
  return clean($.root().text());
}

export function extractArticle(html: string): Article {
  const $ = cheerio.load(html);

  const lang = $("html").attr("lang")?.slice(0, 5) ?? null;
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;

  let publishedAt =
    parseDate($('meta[property="article:published_time"]').attr("content")) ??
    parseDate($('meta[name="date"], meta[name="pubdate"], meta[itemprop="datePublished"]').attr("content")) ??
    parseDate($("time[datetime]").first().attr("datetime"));

  if (!publishedAt) {
    $('script[type="application/ld+json"]').each((_, el) => {
      if (publishedAt) return;
      try {
        const raw = JSON.parse($(el).text());
        for (const node of Array.isArray(raw) ? raw : [raw]) {
          const d = parseDate(node?.datePublished ?? node?.dateCreated ?? node?.uploadDate);
          if (d) {
            publishedAt = d;
            return;
          }
        }
      } catch {
        /* malformed ld+json is common; ignore */
      }
    });
  }

  $(CHROME).remove();

  const candidates = ["article", "main", '[role="main"]', ".article-body", ".post-content", ".entry-content", "#content", ".content", "body"];
  let best = "";
  for (const sel of candidates) {
    $(sel).each((_, el) => {
      const node = $(el);
      const text = clean(node.text());
      // Penalise nav-like blocks where most text sits inside links.
      const linkChars = node.find("a").text().length;
      const density = text.length > 0 ? 1 - linkChars / Math.max(text.length, 1) : 0;
      const score = density < 0.35 ? text.length * 0.25 : text.length;
      if (score > best.length) best = text;
    });
    if (best.length > 1200) break;
  }

  return { title, text: best || clean($("body").text()), publishedAt, lang };
}

/** Collect same-origin links from a page, resolved to absolute URLs. */
export function linksFrom(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const u = new URL(href, base);
      u.hash = "";
      if (u.protocol === "http:" || u.protocol === "https:") out.add(u.toString());
    } catch {
      /* skip unparseable href */
    }
  });
  return [...out];
}

export { clean as normalizeText, parseDate };
