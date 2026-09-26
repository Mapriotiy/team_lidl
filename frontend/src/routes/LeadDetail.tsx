/**
 * Lead detail — Screen 3.
 *
 * The whole point of this product is that a score can be audited, so the comp's
 * "Why X is a fit" panel is backed by the real per-question contributions and
 * every claim keeps the quote and URL it came from. An unverified quote — one
 * the backend could not match back to the stored document — is labelled as
 * such rather than quietly shown alongside verified ones.
 */
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  Copy,
  Database,
  ExternalLink,
  Globe,
  Newspaper,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/api";
import type { Evidence, Outreach as OutreachDraft, Signal, SourceKind } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useBreadcrumb } from "@/components/AppShell";
import { Loading, ErrorState, EmptyState, Banner } from "@/components/states";
import { BandChip, CompanyMark, PolarityChip, ScoreRing, VerdictChip, WeightChip } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldLabel, Meter, Tooltip } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { fmtAge, fmtDate, fmtDateTime, fmtInt, fmtScore, hostOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOURCE_ICON: Record<SourceKind, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  jobs: BriefcaseBusiness,
  news: Newspaper,
  firmographics: Database,
};

export function LeadDetail() {
  const { companyId = "" } = useParams();
  const { serviceKey } = useWorkspace();
  const navigate = useNavigate();
  const outreachRef = useRef<HTMLDivElement>(null);

  const detail = useAsync(
    () => api.lead(companyId, serviceKey),
    [companyId, serviceKey],
    Boolean(companyId && serviceKey),
  );

  useBreadcrumb(
    [{ label: "Leads", to: "/leads" }, { label: detail.data?.company.name ?? "Lead" }],
    [detail.data?.company.name],
  );

  if (detail.error) {
    return (
      <>
        <BackLink />
        <ErrorState error={detail.error} what="this lead" onRetry={detail.reload} />
      </>
    );
  }

  if (detail.loading && detail.firstLoad) {
    return (
      <>
        <BackLink />
        <Loading label="Loading the evidence trail" rows={6} />
      </>
    );
  }

  if (!detail.data) {
    return (
      <>
        <BackLink />
        <EmptyState title="Lead not found" body="This company is not available for the selected service." />
      </>
    );
  }

  const { company, service, score, sources, drafts } = detail.data;
  const b = score?.breakdown;
  // fit_score and intent_score are stored 0..100, so the weights apply directly:
  // total = fit_weight * fit_score + (1 - fit_weight) * intent_score - penalty.
  const fitTerm = score && b ? b.fit_weight * score.fit_score : 0;
  const intentTerm = score && b ? (1 - b.fit_weight) * score.intent_score : 0;

  return (
    <>
      <BackLink />

      {/* ---------------------------------------------------------- header */}
      <section className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-5">
          <CompanyMark name={company.name} size="lg" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">{company.name}</h2>
              {score && <BandChip band={score.band} />}
            </div>
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {company.domain}
              <ExternalLink className="size-3.5" />
            </a>
            <div className="flex flex-wrap items-center gap-2">
              {company.industry && <Badge variant="muted">{company.industry}</Badge>}
              {company.employee_count !== null && (
                <Badge variant="muted">{fmtInt(company.employee_count)} employees</Badge>
              )}
              {company.country && <Badge variant="muted">{company.country}</Badge>}
              {company.ats_provider && <Badge variant="outline">ATS: {company.ats_provider}</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => outreachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Sparkles className="size-4" />
            Draft outreach
          </Button>
          <Button variant="outline" onClick={() => navigate("/leads")}>
            All leads
          </Button>
        </div>
      </section>

      {!score || !b ? (
        <EmptyState
          title={`Not scored for ${service.name} yet`}
          body={`${company.name} is in the database but has no score for this service. Run the scoring pipeline, or use "Re-score all" on the ICP screen, then reload.`}
          action={
            <Button variant="outline" onClick={detail.reload}>
              Reload
            </Button>
          }
        />
      ) : (
        <>
          {score.disqualified && (
            <Banner tone="error">
              <span className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Disqualified — do not work this lead.</strong> A disqualifying signal was confirmed at 50%
                  confidence or more, so the total is forced to zero whatever the fit and intent say. The rule that
                  fired is marked below.
                </span>
              </span>
            </Banner>
          )}

          {/* ------------------------------------------- score + firmographics */}
          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="items-center justify-center gap-4 p-6">
              <ScoreRing
                value={score.disqualified ? 0 : score.total}
                muted={score.disqualified}
                caption={score.disqualified ? "disqualified" : "/ 100"}
              />
              <div className="text-center">
                <p className="text-lg font-semibold">{bandLabel(score.band)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {score.computed_at ? `Scored ${fmtDateTime(score.computed_at)}` : "Never scored"}
                </p>
              </div>
            </Card>

            <Card className="gap-6 p-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <Fact label="Employees" value={fmtInt(company.employee_count)} />
                <Fact label="Headquarters" value={company.hq_city ?? company.country ?? "—"} />
                <Fact label="Founded" value={company.founded_year ? String(company.founded_year) : "—"} />
                <Fact label="Revenue band" value={company.revenue_band ?? "—"} />
                <Fact label="Evidence" value={`${fmtInt(sources.reduce((n, s) => n + s.n, 0))} documents`} />
                <Fact label="ICP" value={b.icp.name ?? "none configured"} />
              </div>
              {company.description && (
                <p className="max-w-[80ch] border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
                  {company.description}
                </p>
              )}
            </Card>
          </section>

          {/* ------------------------------------------ why + score breakdown */}
          <section className="grid gap-4 lg:grid-cols-2">
            <WhyItFits signals={b.signals} reasons={b.top_reasons} />
            <ScoreBreakdown
              fitScore={score.fit_score}
              intentScore={score.intent_score}
              penalty={score.penalty}
              fitWeight={b.fit_weight}
              fitTerm={fitTerm}
              intentTerm={intentTerm}
              total={score.total}
              disqualified={score.disqualified}
              formula={b.formula}
              weightAvailable={b.positive_weight_available}
            />
          </section>

          <EvidenceTimeline signals={b.signals} />
          <AllSignals signals={b.signals} />
          <EvidenceBase sources={sources} companyId={company.id} />

          <div ref={outreachRef}>
            <OutreachPanel
              companyId={company.id}
              companyName={company.name}
              serviceKey={service.key}
              disqualified={score.disqualified}
              priorDrafts={drafts}
            />
          </div>
        </>
      )}
    </>
  );
}

const bandLabel = (band: string) =>
  ({ hot: "Excellent fit", warm: "Good fit", nurture: "Worth nurturing", cold: "Weak fit", disqualified: "Disqualified" })[
    band
  ] ?? band;

function BackLink() {
  return (
    <Link
      to="/leads"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      All leads
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

/* --------------------------------------------------------------- why panel */

function WhyItFits({ signals, reasons }: { signals: Signal[]; reasons: string[] }) {
  const contributors = useMemo(
    () =>
      [...signals]
        .filter((s) => s.contribution !== 0)
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 6),
    [signals],
  );

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">What moved the score</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every question that changed the total, largest effect first. Positive adds intent; negative subtracts a
          penalty that never decays.
        </p>
      </CardHeader>
      <CardContent className="gap-5">
        {contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No question changed the score. The total rests entirely on firmographic fit.
          </p>
        ) : (
          contributors.map((s) => {
            const Icon = SOURCE_ICON[s.evidence[0] ? guessKind(s) : "website"] ?? Globe;
            const top = s.evidence[0];
            return (
              <div key={s.key} className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.weight} weight · {fmtAge(s.evidence_age_days)} · recency ×{s.recency.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      s.contribution > 0 ? "text-[oklch(0.45_0.13_155)]" : "text-destructive",
                    )}
                  >
                    {s.contribution > 0 ? "+" : ""}
                    {s.contribution.toFixed(2)}
                  </span>
                  {top?.url && (
                    <a href={top.url} target="_blank" rel="noreferrer noopener" title={top.url}>
                      <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}

        {reasons.length > 0 && (
          <div className="border-t border-border pt-5">
            <FieldLabel>Summary</FieldLabel>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="text-sm leading-6 text-muted-foreground">
                  — {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Best-effort icon choice from the evidence URL; purely decorative. */
function guessKind(s: Signal): SourceKind {
  const url = s.evidence[0]?.url ?? "";
  if (/greenhouse|lever|workable|jobs|career/i.test(url)) return "jobs";
  if (/news|press|gdelt/i.test(url)) return "news";
  return "website";
}

/* ---------------------------------------------------------- score breakdown */

function ScoreBreakdown({
  fitScore,
  intentScore,
  penalty,
  fitWeight,
  fitTerm,
  intentTerm,
  total,
  disqualified,
  formula,
  weightAvailable,
}: {
  fitScore: number;
  intentScore: number;
  penalty: number;
  fitWeight: number;
  fitTerm: number;
  intentTerm: number;
  total: number;
  disqualified: boolean;
  formula: string;
  weightAvailable: number;
}) {
  const rows = [
    {
      label: "ICP fit",
      raw: fitScore,
      weight: fitWeight,
      term: fitTerm,
      hint: "How well the firmographics match the configured ideal customer profile.",
    },
    {
      label: "Intent",
      raw: intentScore,
      weight: 1 - fitWeight,
      term: intentTerm,
      hint: `Weighted share of positive signals confirmed, each decayed by evidence age. ${weightAvailable} weight points were available to win.`,
    },
  ];

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">Score breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">
          The model answers questions; this arithmetic produces the number. Nothing here is generated.
        </p>
      </CardHeader>
      <CardContent className="gap-5">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Tooltip label={r.hint}>
                <span className="font-medium">{r.label}</span>
              </Tooltip>
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.raw.toFixed(0)} × {r.weight.toFixed(2)} ={" "}
                <span className="font-semibold text-foreground">{r.term.toFixed(1)}</span>
              </span>
            </div>
            <Meter value={r.raw / 100} label={r.label} />
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5 text-sm">
          <span className="font-medium">Penalty</span>
          <span className={cn("font-semibold tabular-nums", penalty > 0 && "text-destructive")}>
            −{penalty.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-semibold tabular-nums">
            {disqualified ? "0.0" : fmtScore(total)}
          </span>
        </div>

        <code className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          {formula || "total = fit_weight × fit × 100 + (1 − fit_weight) × intent × 100 − penalty"}
        </code>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------- evidence timeline */

function EvidenceTimeline({ signals }: { signals: Signal[] }) {
  // One entry per piece of evidence, newest first — the comp's timeline, real.
  const entries = useMemo(() => {
    const all = signals.flatMap((s) =>
      s.evidence.map((e) => ({ ...e, signalKey: s.key, question: s.question, verdict: s.verdict })),
    );
    return all
      .sort((a, b) => {
        const at = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 12);
  }, [signals]);

  if (entries.length === 0) return null;

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">Evidence timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Newest first, across every signal. Each row links to the page the quote was taken from.
        </p>
      </CardHeader>
      <CardContent className="gap-5">
        {entries.map((e, i) => (
          <div key={`${e.url}-${i}`} className="flex items-start gap-4 border-b border-border pb-5 last:border-0 last:pb-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Globe className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{e.title || hostOf(e.url)}</p>
                <span className="text-xs text-muted-foreground">
                  {e.published_at ? fmtDate(e.published_at) : "undated"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">“{e.quote}”</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{e.signalKey}</Badge>
                {!e.verified && (
                  <Tooltip label="This quote could not be matched back to the stored document — treat it with care">
                    <span>
                      <Badge variant="warning">
                        <TriangleAlert className="size-3" />
                        unverified
                      </Badge>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
            <a
              href={e.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Source
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------- all signals */

function AllSignals({ signals }: { signals: Signal[] }) {
  const [onlyFired, setOnlyFired] = useState(false);

  const ordered = useMemo(() => {
    const rank = (s: Signal) => {
      if (s.polarity === "disqualifier" && s.verdict === "yes") return 0;
      if (Math.abs(s.contribution) > 0) return 1;
      if (s.verdict === "yes") return 2;
      if (s.verdict === "no") return 3;
      return 4;
    };
    return [...signals].sort((a, b) => rank(a) - rank(b) || Math.abs(b.contribution) - Math.abs(a.contribution));
  }, [signals]);

  if (!signals.length) {
    return (
      <EmptyState
        title="No signal questions were evaluated"
        body="This service has no enabled questions, so there is nothing to explain. Add questions on the Signals screen and re-score."
      />
    );
  }

  const shown = onlyFired ? ordered.filter((s) => s.verdict === "yes") : ordered;
  const fired = ordered.filter((s) => s.verdict === "yes").length;

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl">Every question asked ({signals.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            {fired} confirmed. Questions that found nothing are shown too — an absent signal is information.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch checked={onlyFired} onCheckedChange={setOnlyFired} />
          Only confirmed
        </label>
      </CardHeader>
      <CardContent className="gap-3">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing was answered “yes” for this company.</p>
        ) : (
          shown.map((s) => <SignalRow key={s.key} signal={s} />)
        )}
      </CardContent>
    </Card>
  );
}

function SignalRow({ signal: s }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const isDq = s.polarity === "disqualifier" && s.verdict === "yes";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isDq
          ? "border-destructive/40 bg-destructive/5"
          : s.contribution > 0
            ? "border-border"
            : s.contribution < 0
              ? "border-[oklch(0.86_0.09_75)]"
              : "border-border opacity-80",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{s.key}</p>
          <p className="mt-1 text-sm font-medium">{s.question}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <VerdictChip verdict={s.verdict} />
          <PolarityChip polarity={s.polarity} />
          <WeightChip weight={s.weight} />
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {isDq && (
        <p className="mt-3 text-sm font-medium text-destructive">
          This disqualifying rule fired — it zeroes the whole score on its own.
        </p>
      )}

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Metric label="Confidence" value={`${(s.confidence * 100).toFixed(0)}%`} meter={s.confidence} />
            <Metric label="Recency" value={`${s.recency.toFixed(2)}×`} meter={s.recency} />
            <Metric label="Evidence age" value={fmtAge(s.evidence_age_days)} />
            <Metric
              label="Contribution"
              value={`${s.contribution > 0 ? "+" : ""}${s.contribution.toFixed(2)}`}
              tone={s.contribution > 0 ? "pos" : s.contribution < 0 ? "neg" : undefined}
            />
          </div>

          {s.rationale && <p className="text-sm leading-6 text-muted-foreground">{s.rationale}</p>}

          {s.evidence.length > 0 ? (
            <div className="flex flex-col gap-3">
              {s.evidence.map((e, i) => (
                <EvidenceQuote key={`${e.url}-${i}`} evidence={e} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {s.verdict === "yes"
                ? "Confirmed without a quotable passage — treat with care."
                : "No supporting passage was found in the scraped documents."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  meter,
  tone,
}: {
  label: string;
  value: string;
  meter?: number;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "pos" && "text-[oklch(0.45_0.13_155)]",
          tone === "neg" && "text-destructive",
        )}
      >
        {value}
      </p>
      {meter !== undefined && <Meter value={meter} label={label} className="h-1.5" />}
    </div>
  );
}

function EvidenceQuote({ evidence: e }: { evidence: Evidence }) {
  return (
    <figure
      className={cn(
        "m-0 rounded-xl border-l-2 bg-muted/50 px-4 py-3",
        e.verified ? "border-l-primary" : "border-l-[oklch(0.75_0.14_75)]",
      )}
    >
      <blockquote className="text-sm leading-6">“{e.quote}”</blockquote>
      <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {!e.verified && (
          <Badge variant="warning">
            <TriangleAlert className="size-3" />
            unverified quote
          </Badge>
        )}
        <a
          href={e.url}
          target="_blank"
          rel="noreferrer noopener"
          title={e.url}
          className="font-medium text-foreground hover:underline"
        >
          {e.title || hostOf(e.url)}
        </a>
        <span>{hostOf(e.url)}</span>
        <span>{e.published_at ? fmtDate(e.published_at) : "undated"}</span>
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------- evidence base */

function EvidenceBase({
  sources,
  companyId,
}: {
  sources: Array<{ source_kind: SourceKind; source_name: string; n: number; newest: string | null }>;
  companyId: string;
}) {
  const [showDocs, setShowDocs] = useState(false);
  const docs = useAsync(() => api.documents(companyId), [companyId, showDocs], showDocs);

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl">Evidence base</CardTitle>
          <p className="text-sm text-muted-foreground">What the crawler actually stored for this company.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDocs((v) => !v)}>
          {showDocs ? "Hide documents" : "List documents"}
        </Button>
      </CardHeader>
      <CardContent className="gap-4">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents stored. This score rests on firmographics alone — worth re-running ingest.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => {
              const Icon = SOURCE_ICON[s.source_kind] ?? Globe;
              return (
                <Tooltip key={`${s.source_kind}-${s.source_name}`} label={`Newest: ${fmtDate(s.newest)}`}>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <Icon className="size-3.5 text-muted-foreground" />
                    {s.source_name}
                    <span className="font-semibold tabular-nums">{fmtInt(s.n)}</span>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        )}

        {showDocs && (
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            {docs.error ? (
              <p className="p-4 text-sm text-destructive">{docs.error}</p>
            ) : docs.loading && docs.firstLoad ? (
              <p className="p-4 text-sm text-muted-foreground">Loading documents…</p>
            ) : !docs.data?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing was stored for this company.</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Kind</th>
                    <th scope="col" className="px-4 py-3">Published</th>
                    <th scope="col" className="px-4 py-3 text-right">Characters</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.data.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="max-w-[420px] px-4 py-3">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title={d.url}
                          className="line-clamp-1 hover:underline"
                        >
                          {d.title || hostOf(d.url)}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="muted">{d.source_kind}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.published_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtInt(d.chars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- outreach */

function OutreachPanel({
  companyId,
  companyName,
  serviceKey,
  disqualified,
  priorDrafts,
}: {
  companyId: string;
  companyName: string;
  serviceKey: string;
  disqualified: boolean;
  priorDrafts: Array<{ id: string; channel: string; subject: string | null; body: string; created_at: string }>;
}) {
  const [channel, setChannel] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setDraft(await api.outreach(companyId, serviceKey, channel));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy — your browser blocked clipboard access.");
    }
  };

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">Outreach</CardTitle>
        <p className="text-sm text-muted-foreground">
          Written only from the verified evidence above. If nothing is confirmed, the backend refuses rather than
          inventing a reason to call.
        </p>
      </CardHeader>
      <CardContent className="gap-4">
        {disqualified && (
          <Banner>
            This lead is disqualified. You can still draft outreach, but read the rule that fired first.
          </Banner>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <FieldLabel>Channel</FieldLabel>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-[160px]" aria-label="Outreach channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={busy}>
            <Sparkles className="size-4" />
            {busy ? "Writing…" : draft ? "Regenerate" : "Generate outreach"}
          </Button>
          {busy && <span className="text-sm text-muted-foreground">The model reads the evidence first — a few seconds.</span>}
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        {draft && (
          <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
            <div>
              <FieldLabel>Subject</FieldLabel>
              <p className="mt-1.5 font-semibold">{draft.subject}</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>Email body</FieldLabel>
                <Button variant="ghost" size="sm" onClick={() => copy(draft.email_body)}>
                  <Copy className="size-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{draft.email_body}</p>
            </div>

            {draft.linkedin_message && (
              <div>
                <FieldLabel>LinkedIn message</FieldLabel>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{draft.linkedin_message}</p>
              </div>
            )}

            {draft.talking_points.length > 0 && (
              <div>
                <FieldLabel>Talking points</FieldLabel>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {draft.talking_points.map((t, i) => (
                    <li key={i} className="text-sm leading-6 text-muted-foreground">
                      — {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {draft.evidence_used.length > 0 && (
              <div>
                <FieldLabel>Evidence used</FieldLabel>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {draft.evidence_used.map((u, i) => (
                    <li key={i}>
                      <a
                        href={u}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        {hostOf(u)}
                        <ExternalLink className="size-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!draft && priorDrafts.length > 0 && (
          <div className="flex flex-col gap-2">
            <FieldLabel>Earlier drafts for {companyName}</FieldLabel>
            {priorDrafts.map((d) => (
              <details key={d.id} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {d.subject || `(no subject) · ${d.channel}`}
                  <span className="ml-2 font-normal text-muted-foreground">{fmtDateTime(d.created_at)}</span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{d.body}</p>
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

