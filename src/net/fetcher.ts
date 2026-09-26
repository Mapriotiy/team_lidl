/**
 * Polite HTTP client shared by every scraper.
 *   - obeys robots.txt (cached per host, honours Crawl-delay)
 *   - serialises requests per host with a minimum delay
 *   - caps global concurrency
 *   - retries 429/5xx with exponential backoff and honours Retry-After
 *
 * Every custom adapter goes through this. Nothing calls fetch() directly.
 */
import { settings } from "../settings.js";

class Semaphore {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}

const gate = new Semaphore(settings.concurrency);
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, Promise<RobotsRules>>();

interface RobotsRules {
  allow: string[];
  disallow: string[];
  crawlDelayMs: number;
}

const EMPTY_RULES: RobotsRules = { allow: [], disallow: [], crawlDelayMs: 0 };

function parseRobots(txt: string, ua: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], crawlDelayMs: 0 };
  const uaToken = (ua.split("/")[0] ?? "").toLowerCase();
  let applies = false;
  let sawSpecific = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;

    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      const v = value.toLowerCase();
      if (v === uaToken) {
        // A block naming us overrides anything collected from the wildcard block.
        applies = true;
        sawSpecific = true;
        rules.allow = [];
        rules.disallow = [];
      } else if (v === "*" && !sawSpecific) {
        applies = true;
      } else {
        applies = false;
      }
      continue;
    }

    if (!applies) continue;
    if (field === "disallow" && value) rules.disallow.push(value);
    else if (field === "allow" && value) rules.allow.push(value);
    else if (field === "crawl-delay") rules.crawlDelayMs = Math.min((Number(value) || 0) * 1000, 30000);
  }
  return rules;
}

/** robots.txt path matching: `*` matches any run of characters, trailing `$` anchors the end. */
function pathMatches(path: string, rule: string): boolean {
  const escaped = rule.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? escaped.slice(0, -2) + "$" : escaped;
  try {
    return new RegExp("^" + anchored).test(path);
  } catch {
    return false;
  }
}

async function robotsFor(origin: string): Promise<RobotsRules> {
  let cached = robotsCache.get(origin);
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch(origin + "/robots.txt", {
          headers: { "user-agent": settings.userAgent },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return EMPTY_RULES;
        return parseRobots(await res.text(), settings.userAgent);
      } catch {
        return EMPTY_RULES;
      }
    })();
    robotsCache.set(origin, cached);
  }
  return cached;
}

export async function isAllowed(url: string): Promise<boolean> {
  if (!settings.respectRobots) return true;
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  const path = u.pathname + u.search;
  // Most specific rule wins; Allow beats Disallow at equal specificity.
  const longest = (list: string[]) =>
    list.filter((r) => pathMatches(path, r)).reduce((m, r) => Math.max(m, r.length), -1);
  return longest(rules.allow) >= longest(rules.disallow);
}

async function throttle(origin: string): Promise<void> {
  const rules = settings.respectRobots ? await robotsFor(origin) : EMPTY_RULES;
  const delay = Math.max(settings.perHostDelayMs, rules.crawlDelayMs);
  const wait = (lastHit.get(origin) ?? 0) + delay - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(origin, Date.now());
}

export interface FetchOpts {
  accept?: string;
  /** Bypass robots for vendor JSON APIs published expressly for programmatic use. */
  skipRobots?: boolean;
  retries?: number;
  timeoutMs?: number;
  /** Some ATS APIs (Workday) only answer POST. */
  method?: "GET" | "POST";
  body?: unknown;
}

export async function politeFetch(url: string, opts: FetchOpts = {}): Promise<string | null> {
  const accept = opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8";
  const skipRobots = opts.skipRobots ?? false;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 25000;

  if (!skipRobots && !(await isAllowed(url))) {
    console.warn("  robots.txt disallows " + url + " - skipped");
    return null;
  }

  const origin = new URL(url).origin;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await gate.acquire();
    try {
      await throttle(origin);
      const headers: Record<string, string> = {
        "user-agent": settings.userAgent,
        accept,
        "accept-language": "en,de,ro;q=0.8",
      };
      if (opts.body !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(url, {
        method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
        const backoff = retryAfter || Math.min(Math.pow(2, attempt) * 1500, 20000);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return await res.text();
    } catch {
      if (attempt >= retries) return null;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    } finally {
      gate.release();
    }
  }
  return null;
}

export async function fetchJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T | null> {
  const body = await politeFetch(url, { accept: "application/json", skipRobots: true, ...opts });
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
