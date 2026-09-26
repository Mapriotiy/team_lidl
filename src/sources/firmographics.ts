/**
 * Company profile data used for Ideal Customer Profile fit: country, industry,
 * headcount, founding year.
 *
 * Crunchbase is the brief's preferred source but its API requires a paid licence,
 * so it sits behind an adapter with two keyless fallbacks:
 *   1. config/crunchbase_seed.json - a manual export, keyed by domain. Lets the demo
 *      run with real Crunchbase-shaped data and no key.
 *   2. Wikidata - open, no key, good coverage of mid-market and enterprise firms.
 * Whichever answers first wins. Swapping in a real Crunchbase key changes nothing
 * downstream.
 */
import { readFileSync, existsSync } from "node:fs";
import { fetchJson, politeFetch } from "../net/fetcher.js";
import { extractArticle } from "../net/extract.js";
import { settings } from "../settings.js";

export interface Firmographics {
  name?: string;
  country?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  revenue_band?: string | null;
  hq_city?: string | null;
  founded_year?: number | null;
  description?: string | null;
  external_ids?: Record<string, unknown>;
  source: string;
}

const SEED_PATH = "config/crunchbase_seed.json";

export function fromSeedFile(domain: string): Firmographics | null {
  if (!existsSync(SEED_PATH)) return null;
  try {
    const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Record<string, any>;
    const row = seed[domain.replace(/^www\./, "")];
    if (!row) return null;
    return { ...row, source: "crunchbase_seed" };
  } catch {
    return null;
  }
}

export async function fromCrunchbase(domain: string): Promise<Firmographics | null> {
  if (!settings.crunchbaseKey) return null;
  const url =
    "https://api.crunchbase.com/api/v4/searches/organizations" +
    `?user_key=${encodeURIComponent(settings.crunchbaseKey)}`;
  const body = await fetchJson<any>(url + `&query=${encodeURIComponent(domain)}`);
  const entity = body?.entities?.[0]?.properties;
  if (!entity) return null;
  return {
    name: entity.name,
    country: entity.location_identifiers?.find((l: any) => l.location_type === "country")?.value ?? null,
    industry: entity.categories?.[0]?.value ?? null,
    employee_count: null,
    revenue_band: entity.revenue_range ?? null,
    hq_city: entity.location_identifiers?.find((l: any) => l.location_type === "city")?.value ?? null,
    founded_year: entity.founded_on?.value ? Number(String(entity.founded_on.value).slice(0, 4)) : null,
    description: entity.short_description ?? null,
    external_ids: { crunchbase_permalink: entity.permalink },
    source: "crunchbase",
  };
}

const WD = "https://www.wikidata.org/w/api.php";

export async function fromWikidata(companyName: string, domain: string): Promise<Firmographics | null> {
  const search = await fetchJson<any>(
    `${WD}?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&format=json&type=item&limit=5&origin=*`,
  );
  const ids: string[] = (search?.search ?? []).map((s: any) => s.id).filter(Boolean);
  if (!ids.length) return null;

  const entities = await fetchJson<any>(
    `${WD}?action=wbgetentities&ids=${ids.join("|")}&props=claims|descriptions|labels&languages=en&format=json&origin=*`,
  );
  if (!entities?.entities) return null;

  const bare = domain.replace(/^www\./, "").toLowerCase();
  let chosen: any = null;

  for (const id of ids) {
    const ent = entities.entities[id];
    if (!ent) continue;
    const sites: string[] = (ent.claims?.P856 ?? []).map((c: any) => String(c.mainsnak?.datavalue?.value ?? ""));
    // A matching official website is the only reliable way to know we have the right company.
    if (sites.some((s) => { try { return new URL(s).hostname.replace(/^www\./, "").toLowerCase() === bare; } catch { return false; } })) {
      chosen = ent;
      break;
    }
  }
  if (!chosen) return null;

  const amount = (p: string): number | null => {
    const v = chosen.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.amount;
    return v ? Math.abs(Number(v)) : null;
  };
  const entityRef = (p: string): string | null => chosen.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
  const timeYear = (p: string): number | null => {
    const t = chosen.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.time;
    return t ? Number(String(t).replace(/^[+-]/, "").slice(0, 4)) : null;
  };

  const refs = [entityRef("P17"), entityRef("P452"), entityRef("P159")].filter(Boolean) as string[];
  const labels: Record<string, string> = {};
  if (refs.length) {
    const resolved = await fetchJson<any>(
      `${WD}?action=wbgetentities&ids=${refs.join("|")}&props=labels&languages=en&format=json&origin=*`,
    );
    for (const id of refs) {
      const label = resolved?.entities?.[id]?.labels?.en?.value;
      if (label) labels[id] = label;
    }
  }

  return {
    name: chosen.labels?.en?.value,
    country: labels[entityRef("P17") ?? ""] ?? null,
    industry: labels[entityRef("P452") ?? ""] ?? null,
    employee_count: amount("P1128"),
    hq_city: labels[entityRef("P159") ?? ""] ?? null,
    founded_year: timeYear("P571"),
    description: chosen.descriptions?.en?.value ?? null,
    external_ids: { wikidata_id: chosen.id },
    source: "wikidata",
  };
}

/** Last resort: the company's own homepage meta description. */
export async function fromHomepage(domain: string): Promise<Firmographics | null> {
  const html = await politeFetch(domain.startsWith("http") ? domain : "https://" + domain);
  if (!html) return null;
  const art = extractArticle(html);
  return {
    description: art.text.slice(0, 600) || null,
    source: "homepage",
  };
}

export async function resolveFirmographics(companyName: string, domain: string): Promise<Firmographics> {
  const layered = [
    fromSeedFile(domain),
    await fromCrunchbase(domain).catch(() => null),
    await fromWikidata(companyName, domain).catch(() => null),
    await fromHomepage(domain).catch(() => null),
  ].filter(Boolean) as Firmographics[];

  // Merge best-first: earlier sources win on any field they actually populated.
  const merged: Firmographics = { source: layered.map((l) => l.source).join("+") || "none" };
  for (const layer of layered) {
    for (const [k, v] of Object.entries(layer)) {
      if (k === "source" || v === null || v === undefined) continue;
      if ((merged as any)[k] === undefined) (merged as any)[k] = v;
    }
  }
  return merged;
}
