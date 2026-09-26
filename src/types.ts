export type SourceKind = "website" | "jobs" | "news" | "firmographics";
export type Weight = "high" | "medium" | "low";
export type Polarity = "positive" | "negative" | "disqualifier";
export type Verdict = "yes" | "no" | "unknown";

export interface Company {
  id: string;
  name: string;
  domain: string;
  country: string | null;
  industry: string | null;
  employee_count: number | null;
  revenue_band: string | null;
  hq_city: string | null;
  founded_year: number | null;
  description: string | null;
  careers_url: string | null;
  ats_provider: string | null;
  ats_slug: string | null;
  external_ids: Record<string, unknown>;
}

/** A normalized unit of evidence produced by any source adapter. */
export interface RawDoc {
  sourceKind: SourceKind;
  sourceName: string;
  url: string;
  title?: string;
  publishedAt?: Date | null;
  content: string;
  lang?: string;
  meta?: Record<string, unknown>;
}

export interface SignalQuestion {
  id: string;
  service_id: string;
  key: string;
  text: string;
  weight: Weight;
  polarity: Polarity;
  source_kinds: SourceKind[];
  half_life_days: number;
  enabled: boolean;
}

export interface EvidenceRef {
  quote: string;
  url: string;
  title: string | null;
  published_at: string | null;
  verified: boolean;
}
