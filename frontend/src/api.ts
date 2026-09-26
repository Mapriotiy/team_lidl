/**
 * Typed client for the Orange Signal Express API.
 *
 * Two things this file is careful about, because the backend is Postgres-backed:
 *  - counts and numerics arrive as strings ("42", "71.30"); everything numeric is
 *    coerced through num() at the boundary so views never compare or format a string.
 *  - errors come back as { error: "..." } with a real message worth showing
 *    ("Acme has no verified positive signals to write from"), so we surface it.
 */

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

export type Weight = "high" | "medium" | "low";
export type Polarity = "positive" | "negative" | "disqualifier";
export type Verdict = "yes" | "no" | "unknown";
export type Band = "hot" | "warm" | "nurture" | "cold" | "disqualified";
export type SourceKind = "website" | "jobs" | "news" | "firmographics";

export const BANDS: Band[] = ["hot", "warm", "nurture", "cold", "disqualified"];
export const WEIGHTS: Weight[] = ["high", "medium", "low"];
export const POLARITIES: Polarity[] = ["positive", "negative", "disqualifier"];
export const SOURCE_KINDS: SourceKind[] = ["website", "jobs", "news", "firmographics"];

/** Band cut-offs, mirrored from src/scoring/score.ts so charts can mark them. */
export const BAND_THRESHOLDS = { hot: 70, warm: 45, nurture: 25 } as const;

/** Postgres hands us numerics as strings. Never trust a number field. */
export const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_URL}. Is the server running?`, 0);
  }

  if (res.status === 204) return undefined as T;

  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : raw.slice(0, 200) || res.statusText;
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }

  return body as T;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/* ------------------------------------------------------------------ types */

export interface Stats {
  companies: number;
  documents: number;
  signals_detected: number;
  hot: number;
  warm: number;
  disqualified: number;
}

export interface Service {
  id: string;
  key: string;
  name: string;
  description: string | null;
  value_prop: string | null;
  active: boolean;
  question_count: number;
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

export interface IcpProfile {
  id: string;
  name: string;
  countries: string[];
  industries: string[];
  min_employees: number | null;
  max_employees: number | null;
  exclude_industries: string[];
  fit_weight: number;
}

export interface Lead {
  id: string;
  name: string;
  domain: string;
  country: string | null;
  industry: string | null;
  employee_count: number | null;
  ats_provider: string | null;
  service_key: string;
  service_name: string;
  total: number;
  band: Band;
  fit_score: number;
  intent_score: number;
  penalty: number;
  disqualified: boolean;
  computed_at: string | null;
  top_reasons: string[];
  document_count: number;
}

export interface Evidence {
  quote: string;
  url: string;
  title: string | null;
  published_at: string | null;
  verified: boolean;
}

export interface Signal {
  key: string;
  question: string;
  polarity: Polarity;
  weight: Weight;
  verdict: Verdict;
  confidence: number;
  recency: number;
  evidence_age_days: number | null;
  contribution: number;
  rationale: string | null;
  evidence: Evidence[];
}

export interface Breakdown {
  formula: string;
  fit_weight: number;
  icp: { name: string | null; score: number; detail: Record<string, unknown> };
  positive_weight_available: number;
  signals: Signal[];
  top_reasons: string[];
}

export interface LeadScore {
  total: number;
  band: Band;
  fit_score: number;
  intent_score: number;
  penalty: number;
  disqualified: boolean;
  computed_at: string | null;
  breakdown: Breakdown;
}

export interface SourceSummary {
  source_kind: SourceKind;
  source_name: string;
  n: number;
  newest: string | null;
}

export interface OutreachDraftRow {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  created_at: string;
}

export interface LeadDetail {
  company: {
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
  };
  service: { id: string; key: string; name: string };
  /** null when the company exists but has not been scored for this service yet. */
  score: LeadScore | null;
  sources: SourceSummary[];
  drafts: OutreachDraftRow[];
}

export interface CompanyDocument {
  id: string;
  source_kind: SourceKind;
  source_name: string;
  url: string;
  title: string | null;
  published_at: string | null;
  fetched_at: string | null;
  chars: number;
}

export interface CrawlLogEntry {
  id: number;
  company_id: string | null;
  source_name: string;
  url: string;
  status: string;
  detail: string | null;
  docs_added: number;
  at: string;
}

export interface CrawlResult {
  company: string;
  added: number;
  error: string | null;
}

/** A crawl started from the dashboard, as it progresses. */
export interface CrawlProgress {
  status: "idle" | "running" | "done" | "failed";
  started_at: string | null;
  finished_at: string | null;
  total: number;
  done: number;
  /** The company being fetched right now. */
  current: string | null;
  documents_added: number;
  results: CrawlResult[];
  error: string | null;
}

export interface Outreach {
  subject: string;
  email_body: string;
  linkedin_message: string;
  value_proposition: string;
  talking_points: string[];
  evidence_used: string[];
}

/* ------------------------------------------- analytics and workspace types */

/** One confirmed signal, as it appears in the live feed on the Signals screen. */
export interface RecentSignal {
  id: string;
  verdict: Verdict;
  confidence: number;
  rationale: string | null;
  evidence: Evidence[];
  evaluated_at: string;
  company_id: string;
  company_name: string;
  domain: string;
  industry: string | null;
  question_key: string;
  question: string;
  polarity: Polarity;
  weight: Weight;
  source_kinds: SourceKind[];
  company_score: number | null;
  band: Band | null;
}

export interface SignalVolume {
  id: string;
  key: string;
  text: string;
  polarity: Polarity;
  weight: Weight;
  enabled: boolean;
  source_kinds: SourceKind[];
  evaluated: number;
  confirmed: number;
  not_found: number;
  unknown: number;
}

export interface SourceHealth {
  source_kind: SourceKind;
  enabled: boolean;
  updated_at: string;
  documents: number;
  companies: number;
  last_fetch: string | null;
  newest_evidence: string | null;
  attempts_24h: number;
  ok_24h: number;
  failed_24h: number;
  last_error: string | null;
  adapters: Array<{ name: string; documents: number; last_fetch: string | null }>;
}

export interface SourcesResponse {
  sources: SourceHealth[];
  hourly: Array<{ hour: string; ok: number; failed: number }>;
}

export interface ReportSummary {
  service: string | null;
  weeks: number;
  totals: {
    scored: number;
    hot: number;
    warm: number;
    disqualified: number;
    avg_score: number;
    avg_fit: number;
    avg_intent: number;
    last_scored: string | null;
  };
  prior: { scored: number; hot: number };
  bands: Array<{ band: Band; n: number }>;
  segments: Array<{ industry: string; n: number; avg_score: number; qualified: number }>;
  distribution: Array<{ decile: number; n: number }>;
  questions: Array<{ key: string; text: string; polarity: Polarity; confirmed: number }>;
  coverage: { companies: number; documents: number; without_evidence: number };
  timeline: Array<{ week: string; documents: number; signals: number }>;
}

export interface SequenceStep {
  day: number;
  channel: string;
  label: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  min_score: number;
  band: Band | null;
  steps: SequenceStep[];
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
  service_key: string;
  service_name: string;
  /** Companies pulled in so far. */
  enrolled: number;
  last_enrolled_at: string | null;
  /** Companies the rule matches right now, enrolled or not. */
  audience: number;
  drafted: number;
}

export interface AudienceRow {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  total: number;
  band: Band;
  enrolled: boolean;
  enrolled_at: string | null;
  drafts: number;
}

export interface OutreachActivity {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  created_at: string;
  company_id: string;
  company_name: string;
  domain: string;
  score: number | null;
  band: Band | null;
}

export interface ReportSchedule {
  id: string;
  service_id: string | null;
  service_key: string | null;
  service_name: string | null;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  recipients: string[];
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

export type MemberRole = "owner" | "admin" | "member";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  created_at: string;
}

export interface NotificationPrefs {
  hot_lead: boolean;
  weekly_digest: boolean;
  crawl_failures: boolean;
  product_updates: boolean;
}

export interface WorkspaceSettings {
  name: string;
  slug: string;
  timezone: string;
  notifications: NotificationPrefs;
  updated_at: string;
}

export interface RuntimeInfo {
  signal_model: string;
  llm_base_url: string;
  llm_key_set: boolean;
  llm_key_source: "database" | "environment" | "none";
  crawler_user_agent: string;
  crawler_concurrency: number;
  per_host_delay_ms: number;
  respect_robots: boolean;
  api_port: number;
  database_host: string;
  crunchbase_key_set: boolean;
  newsapi_key_set: boolean;
  user_agent_is_placeholder: boolean;
}

/**
 * The connected model. The API key itself is never sent to the browser — only
 * whether one is stored and a four-character hint to tell two keys apart.
 */
export interface LlmConfig {
  base_url: string;
  model: string;
  max_tokens: number;
  temperature: number;
  /** Sent with every request to the gateway, alongside the key. */
  extra_headers: Record<string, string>;
  key_set: boolean;
  key_hint: string | null;
  key_source: "database" | "environment" | "none";
  updated_at: string | null;
  /** A key is present in the server environment as a fallback. */
  env_key_available: boolean;
  /** The encryption secret was generated by the server rather than set via APP_SECRET. */
  secret_is_managed: boolean;
}

export interface LlmTestResult {
  ok: true;
  model: string;
  latency_ms: number;
  reply: string;
  usage: { input: number; output: number; cached: number };
}

/** Gateways people are likely to point this at, for the Settings picker. */
export const LLM_PRESETS: Array<{ label: string; base_url: string; model: string; note: string }> = [
  {
    label: "AgentRouter",
    base_url: "https://agentrouter.org/v1",
    model: "claude-opus-5",
    note: "One key across Anthropic, OpenAI, DeepSeek and more.",
  },
  {
    label: "OpenAI",
    base_url: "https://api.openai.com/v1",
    model: "gpt-5",
    note: "Direct to OpenAI.",
  },
  {
    label: "Groq",
    base_url: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    note: "Fast and cheap. The free tier allows only 8k tokens per minute — lower EVIDENCE_CHAR_BUDGET to match.",
  },
  {
    label: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-opus-5",
    note: "Models are namespaced by provider.",
  },
  {
    label: "Ollama (local)",
    base_url: "http://localhost:11434/v1",
    model: "llama3.1",
    note: "Runs on this machine. No key needed — type any placeholder.",
  },
];

/* ------------------------------------------------------------- normalizers */

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

const normLead = (r: Lead): Lead => ({
  ...r,
  employee_count: r.employee_count === null || r.employee_count === undefined ? null : num(r.employee_count),
  total: num(r.total),
  fit_score: num(r.fit_score),
  intent_score: num(r.intent_score),
  penalty: num(r.penalty),
  document_count: num(r.document_count),
  disqualified: Boolean(r.disqualified),
  top_reasons: arr<string>(r.top_reasons),
});

const normSignal = (s: Signal): Signal => ({
  ...s,
  confidence: num(s.confidence),
  recency: num(s.recency),
  contribution: num(s.contribution),
  evidence_age_days:
    s.evidence_age_days === null || s.evidence_age_days === undefined ? null : num(s.evidence_age_days),
  evidence: arr<Evidence>(s.evidence),
});

const normQuestion = (question: SignalQuestion): SignalQuestion => ({
  ...question,
  half_life_days: num(question.half_life_days, 180),
  source_kinds: arr<SourceKind>(question.source_kinds),
  enabled: Boolean(question.enabled),
});

/* ---------------------------------------------------------------- endpoints */

export const api = {
  async stats(): Promise<Stats> {
    const s = await request<Record<string, unknown>>("/api/stats");
    return {
      companies: num(s?.companies),
      documents: num(s?.documents),
      signals_detected: num(s?.signals_detected),
      hot: num(s?.hot),
      warm: num(s?.warm),
      disqualified: num(s?.disqualified),
    };
  },

  async services(): Promise<Service[]> {
    const rows = await request<Service[]>("/api/services");
    return arr<Service>(rows).map((s) => ({ ...s, question_count: num(s.question_count) }));
  },

  async questions(serviceKey: string): Promise<SignalQuestion[]> {
    const rows = await request<SignalQuestion[]>(`/api/services/${encodeURIComponent(serviceKey)}/questions`);
    return arr<SignalQuestion>(rows).map(normQuestion);
  },

  async createQuestion(
    serviceKey: string,
    body: {
      key: string;
      text: string;
      weight: Weight;
      polarity: Polarity;
      source_kinds: SourceKind[];
      half_life_days: number;
    },
  ): Promise<SignalQuestion> {
    const row = await request<SignalQuestion>(`/api/services/${encodeURIComponent(serviceKey)}/questions`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normQuestion(row);
  },

  async updateQuestion(
    id: string,
    patch: Partial<Pick<SignalQuestion, "text" | "weight" | "polarity" | "half_life_days" | "enabled" | "source_kinds">>,
  ): Promise<SignalQuestion> {
    const row = await request<SignalQuestion>(`/api/questions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return normQuestion(row);
  },

  async deleteQuestion(id: string): Promise<void> {
    await request<void>(`/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async icp(serviceKey: string): Promise<IcpProfile | null> {
    const row = await request<IcpProfile | null>(`/api/icp/${encodeURIComponent(serviceKey)}`);
    if (!row) return null;
    return {
      ...row,
      countries: arr<string>(row.countries),
      industries: arr<string>(row.industries),
      exclude_industries: arr<string>(row.exclude_industries),
      min_employees: row.min_employees === null || row.min_employees === undefined ? null : num(row.min_employees),
      max_employees: row.max_employees === null || row.max_employees === undefined ? null : num(row.max_employees),
      fit_weight: num(row.fit_weight, 0.3),
    };
  },

  async saveIcp(serviceKey: string, body: Omit<IcpProfile, "id">): Promise<IcpProfile> {
    return request<IcpProfile>(`/api/icp/${encodeURIComponent(serviceKey)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async leads(params: { service?: string; band?: string; minScore?: number; limit?: number }): Promise<Lead[]> {
    const rows = await request<Lead[]>(`/api/leads${qs(params)}`);
    return arr<Lead>(rows).map(normLead);
  },

  async lead(companyId: string, serviceKey: string): Promise<LeadDetail> {
    const d = await request<LeadDetail>(`/api/leads/${encodeURIComponent(companyId)}${qs({ service: serviceKey })}`);
    return {
      ...d,
      score: d.score
        ? {
            ...d.score,
            total: num(d.score.total),
            fit_score: num(d.score.fit_score),
            intent_score: num(d.score.intent_score),
            penalty: num(d.score.penalty),
            disqualified: Boolean(d.score.disqualified),
            breakdown: {
              formula: d.score.breakdown?.formula ?? "",
              fit_weight: num(d.score.breakdown?.fit_weight, 0.3),
              positive_weight_available: num(d.score.breakdown?.positive_weight_available, 1),
              icp: {
                name: d.score.breakdown?.icp?.name ?? null,
                score: num(d.score.breakdown?.icp?.score),
                detail: d.score.breakdown?.icp?.detail ?? {},
              },
              signals: arr<Signal>(d.score.breakdown?.signals).map(normSignal),
              top_reasons: arr<string>(d.score.breakdown?.top_reasons),
            },
          }
        : null,
      sources: arr<SourceSummary>(d.sources).map((s) => ({ ...s, n: num(s.n) })),
      drafts: arr<OutreachDraftRow>(d.drafts),
    };
  },

  async documents(companyId: string): Promise<CompanyDocument[]> {
    const rows = await request<CompanyDocument[]>(`/api/companies/${encodeURIComponent(companyId)}/documents`);
    return arr<CompanyDocument>(rows).map((d) => ({ ...d, chars: num(d.chars) }));
  },

  async crawlLog(limit = 100): Promise<CrawlLogEntry[]> {
    const rows = await request<CrawlLogEntry[]>(`/api/crawl-log${qs({ limit })}`);
    return arr<CrawlLogEntry>(rows).map((r) => ({ ...r, docs_added: num(r.docs_added) }));
  },

  /** Progress of the current or most recent crawl. */
  async crawl(): Promise<CrawlProgress> {
    const p = await request<CrawlProgress>("/api/crawl");
    return {
      ...p,
      total: num(p?.total),
      done: num(p?.done),
      documents_added: num(p?.documents_added),
      results: arr<CrawlResult>(p?.results),
    };
  },

  /** Starts a crawl and returns at once; poll `crawl()` for progress. */
  async startCrawl(companyId?: string): Promise<CrawlProgress> {
    return request<CrawlProgress>("/api/crawl", {
      method: "POST",
      body: JSON.stringify(companyId ? { company_id: companyId } : {}),
    });
  },

  async addCompany(body: { name: string; domain: string; service?: string }): Promise<unknown> {
    return request<unknown>("/api/companies", { method: "POST", body: JSON.stringify(body) });
  },

  async rescore(service: string): Promise<{ rescored: number }> {
    return request<{ rescored: number }>("/api/rescore", { method: "POST", body: JSON.stringify({ service }) });
  },

  async outreach(companyId: string, service: string, channel = "email"): Promise<Outreach> {
    const d = await request<Outreach>(`/api/leads/${encodeURIComponent(companyId)}/outreach`, {
      method: "POST",
      body: JSON.stringify({ service, channel }),
    });
    return { ...d, talking_points: arr<string>(d?.talking_points), evidence_used: arr<string>(d?.evidence_used) };
  },

  /* ------------------------------------------------------------ analytics */

  async recentSignals(params: { service?: string; kind?: SourceKind | ""; limit?: number }): Promise<RecentSignal[]> {
    const rows = await request<RecentSignal[]>(`/api/signals/recent${qs(params)}`);
    return arr<RecentSignal>(rows).map((r) => ({
      ...r,
      confidence: num(r.confidence),
      company_score: r.company_score === null || r.company_score === undefined ? null : num(r.company_score),
      evidence: arr<Evidence>(r.evidence),
      source_kinds: arr<SourceKind>(r.source_kinds),
    }));
  },

  async signalVolume(serviceKey: string): Promise<SignalVolume[]> {
    const rows = await request<SignalVolume[]>(`/api/signals/volume${qs({ service: serviceKey })}`);
    return arr<SignalVolume>(rows).map((r) => ({
      ...r,
      evaluated: num(r.evaluated),
      confirmed: num(r.confirmed),
      not_found: num(r.not_found),
      unknown: num(r.unknown),
      source_kinds: arr<SourceKind>(r.source_kinds),
      enabled: Boolean(r.enabled),
    }));
  },

  async sources(): Promise<SourcesResponse> {
    const d = await request<SourcesResponse>("/api/sources");
    return {
      sources: arr<SourceHealth>(d?.sources).map((s) => ({
        ...s,
        enabled: Boolean(s.enabled),
        documents: num(s.documents),
        companies: num(s.companies),
        attempts_24h: num(s.attempts_24h),
        ok_24h: num(s.ok_24h),
        failed_24h: num(s.failed_24h),
        adapters: arr<SourceHealth["adapters"][number]>(s.adapters).map((a) => ({ ...a, documents: num(a.documents) })),
      })),
      hourly: arr<{ hour: string; ok: number; failed: number }>(d?.hourly).map((h) => ({
        ...h,
        ok: num(h.ok),
        failed: num(h.failed),
      })),
    };
  },

  async setSourceEnabled(kind: SourceKind, enabled: boolean): Promise<void> {
    await request<unknown>(`/api/sources/${encodeURIComponent(kind)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
  },

  async reportSummary(serviceKey: string, weeks = 12): Promise<ReportSummary> {
    const d = await request<ReportSummary>(`/api/reports/summary${qs({ service: serviceKey, weeks })}`);
    return {
      ...d,
      totals: {
        scored: num(d?.totals?.scored),
        hot: num(d?.totals?.hot),
        warm: num(d?.totals?.warm),
        disqualified: num(d?.totals?.disqualified),
        avg_score: num(d?.totals?.avg_score),
        avg_fit: num(d?.totals?.avg_fit),
        avg_intent: num(d?.totals?.avg_intent),
        last_scored: d?.totals?.last_scored ?? null,
      },
      prior: { scored: num(d?.prior?.scored), hot: num(d?.prior?.hot) },
      bands: arr<{ band: Band; n: number }>(d?.bands).map((b) => ({ ...b, n: num(b.n) })),
      segments: arr<ReportSummary["segments"][number]>(d?.segments).map((s) => ({
        ...s,
        n: num(s.n),
        avg_score: num(s.avg_score),
        qualified: num(s.qualified),
      })),
      distribution: arr<{ decile: number; n: number }>(d?.distribution).map((x) => ({
        decile: num(x.decile),
        n: num(x.n),
      })),
      questions: arr<ReportSummary["questions"][number]>(d?.questions).map((x) => ({ ...x, confirmed: num(x.confirmed) })),
      coverage: {
        companies: num(d?.coverage?.companies),
        documents: num(d?.coverage?.documents),
        without_evidence: num(d?.coverage?.without_evidence),
      },
      timeline: arr<ReportSummary["timeline"][number]>(d?.timeline).map((t) => ({
        ...t,
        documents: num(t.documents),
        signals: num(t.signals),
      })),
    };
  },

  /** The CSV export is a plain link, so callers only need the URL. */
  exportUrl(serviceKey: string): string {
    return `${API_URL}/api/reports/export.csv${qs({ service: serviceKey })}`;
  },

  /* ------------------------------------------------------------ sequences */

  async sequences(serviceKey: string): Promise<Sequence[]> {
    const rows = await request<Sequence[]>(`/api/sequences${qs({ service: serviceKey })}`);
    return arr<Sequence>(rows).map(normSequence);
  },

  async createSequence(body: {
    service: string;
    name: string;
    description?: string;
    min_score: number;
    band: Band | null;
    steps: SequenceStep[];
  }): Promise<Sequence> {
    return normSequence(await request<Sequence>("/api/sequences", { method: "POST", body: JSON.stringify(body) }));
  },

  async updateSequence(
    id: string,
    patch: Partial<Pick<Sequence, "name" | "description" | "min_score" | "band" | "steps" | "status">>,
  ): Promise<Sequence> {
    return normSequence(
      await request<Sequence>(`/api/sequences/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
  },

  async deleteSequence(id: string): Promise<void> {
    await request<void>(`/api/sequences/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async sequenceAudience(id: string): Promise<AudienceRow[]> {
    const rows = await request<AudienceRow[]>(`/api/sequences/${encodeURIComponent(id)}/audience`);
    return arr<AudienceRow>(rows).map((r) => ({
      ...r,
      total: num(r.total),
      drafts: num(r.drafts),
      enrolled: Boolean(r.enrolled),
    }));
  },

  async enrollSequence(id: string): Promise<{ enrolled: number; sequence: Sequence }> {
    const d = await request<{ enrolled: number; sequence: Sequence }>(
      `/api/sequences/${encodeURIComponent(id)}/enroll`,
      { method: "POST" },
    );
    return { enrolled: num(d?.enrolled), sequence: normSequence(d.sequence) };
  },

  async removeEnrollment(sequenceId: string, companyId: string): Promise<void> {
    await request<void>(
      `/api/sequences/${encodeURIComponent(sequenceId)}/enrollments/${encodeURIComponent(companyId)}`,
      { method: "DELETE" },
    );
  },

  async outreachActivity(serviceKey: string, limit = 30): Promise<OutreachActivity[]> {
    const rows = await request<OutreachActivity[]>(`/api/outreach/activity${qs({ service: serviceKey, limit })}`);
    return arr<OutreachActivity>(rows).map((r) => ({
      ...r,
      score: r.score === null || r.score === undefined ? null : num(r.score),
    }));
  },

  /* ------------------------------------------------------- workspace state */

  async reportSchedules(): Promise<ReportSchedule[]> {
    const rows = await request<ReportSchedule[]>("/api/report-schedules");
    return arr<ReportSchedule>(rows).map((r) => ({
      ...r,
      recipients: arr<string>(r.recipients),
      enabled: Boolean(r.enabled),
    }));
  },

  async createReportSchedule(body: {
    name: string;
    cadence: ReportSchedule["cadence"];
    recipients: string[];
    service?: string;
  }): Promise<ReportSchedule> {
    const r = await request<ReportSchedule>("/api/report-schedules", { method: "POST", body: JSON.stringify(body) });
    return { ...r, recipients: arr<string>(r.recipients), enabled: Boolean(r.enabled) };
  },

  async setReportScheduleEnabled(id: string, enabled: boolean): Promise<void> {
    await request<unknown>(`/api/report-schedules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
  },

  async deleteReportSchedule(id: string): Promise<void> {
    await request<void>(`/api/report-schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async members(): Promise<Member[]> {
    return arr<Member>(await request<Member[]>("/api/members"));
  },

  async addMember(body: { name: string; email: string; role: MemberRole }): Promise<Member> {
    return request<Member>("/api/members", { method: "POST", body: JSON.stringify(body) });
  },

  async updateMemberRole(id: string, role: MemberRole): Promise<Member> {
    return request<Member>(`/api/members/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async removeMember(id: string): Promise<void> {
    await request<void>(`/api/members/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async settings(): Promise<WorkspaceSettings> {
    const s = await request<WorkspaceSettings>("/api/settings");
    return { ...s, notifications: { ...DEFAULT_NOTIFICATIONS, ...(s?.notifications ?? {}) } };
  },

  async saveSettings(body: Omit<WorkspaceSettings, "updated_at">): Promise<WorkspaceSettings> {
    const s = await request<WorkspaceSettings>("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    return { ...s, notifications: { ...DEFAULT_NOTIFICATIONS, ...(s?.notifications ?? {}) } };
  },

  async runtime(): Promise<RuntimeInfo> {
    return request<RuntimeInfo>("/api/runtime");
  },

  /* ----------------------------------------------------------- model config */

  async llm(): Promise<LlmConfig> {
    const c = await request<LlmConfig>("/api/llm");
    return {
      ...c,
      max_tokens: num(c?.max_tokens, 8000),
      temperature: num(c?.temperature, 0.2),
      extra_headers: c?.extra_headers ?? {},
    };
  },

  /**
   * Omit `api_key` to keep the stored one; pass "" to clear it and fall back to
   * the server environment.
   */
  async saveLlm(body: {
    base_url: string;
    model: string;
    max_tokens?: number;
    temperature?: number;
    api_key?: string;
    extra_headers?: Record<string, string>;
  }): Promise<LlmConfig> {
    const c = await request<LlmConfig>("/api/llm", { method: "PUT", body: JSON.stringify(body) });
    return {
      ...c,
      max_tokens: num(c?.max_tokens, 8000),
      temperature: num(c?.temperature, 0.2),
      extra_headers: c?.extra_headers ?? {},
    };
  },

  async llmModels(): Promise<string[]> {
    const d = await request<{ models: string[] }>("/api/llm/models");
    return arr<string>(d?.models);
  },

  /** Pass overrides to test credentials before saving them. */
  async testLlm(body?: {
    base_url?: string;
    model?: string;
    api_key?: string;
    extra_headers?: Record<string, string>;
  }): Promise<LlmTestResult> {
    return request<LlmTestResult>("/api/llm/test", { method: "POST", body: JSON.stringify(body ?? {}) });
  },
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  hot_lead: true,
  weekly_digest: true,
  crawl_failures: true,
  product_updates: false,
};

function normSequence(s: Sequence): Sequence {
  return {
    ...s,
    min_score: num(s.min_score),
    enrolled: num(s.enrolled),
    audience: num(s.audience),
    drafted: num(s.drafted),
    steps: arr<SequenceStep>(s.steps).map((st, i) => ({
      day: num(st.day, i + 1),
      channel: st.channel ?? "email",
      label: st.label ?? "Step",
    })),
  };
}
