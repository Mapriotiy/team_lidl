/**
 * Overview — Screen 1.
 *
 * The comp showed pipeline value in dollars. This platform never sees money,
 * so the four tiles report what it does measure: qualified accounts, average
 * score, confirmed signals and the evidence base behind them. Deltas compare
 * against the state before the selected window rather than being invented.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Radio,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/api";
import type { RecentSignal } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { BandChip } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { fmtDelta, fmtInt, fmtRelative, fmtScore, hostOf } from "@/lib/format";

const WINDOWS = [
  { value: "4", label: "Last 4 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "26", label: "Last 26 weeks" },
];

export function Overview() {
  const gate = useServiceGate();
  const { service, serviceKey } = useWorkspace();
  const [weeks, setWeeks] = useState("12");

  const summary = useAsync(
    () => api.reportSummary(serviceKey, Number(weeks)),
    [serviceKey, weeks],
    Boolean(serviceKey),
  );
  const leads = useAsync(() => api.leads({ service: serviceKey, limit: 6 }), [serviceKey], Boolean(serviceKey));
  const signals = useAsync(
    () => api.recentSignals({ service: serviceKey, limit: 5 }),
    [serviceKey],
    Boolean(serviceKey),
  );

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          service?.description ??
          `What changed across the ${service?.name ?? "selected"} pipeline, drawn from stored evidence only.`
        }
        actions={
          <>
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger className="w-[164px]" aria-label="Reporting window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddCompanyDialog
              onAdded={() => {
                summary.reload();
                leads.reload();
                signals.reload();
              }}
            />
          </>
        }
      />

      {summary.error ? (
        <ErrorState error={summary.error} what="the pipeline summary" onRetry={summary.reload} />
      ) : summary.loading && summary.firstLoad ? (
        <Loading label="Reading the pipeline" rows={4} />
      ) : summary.data && summary.data.totals.scored === 0 ? (
        <EmptyState
          title="Nothing scored for this service yet"
          body="Add a prospect to run the full crawl, evaluate and score pipeline, or run npm run pipeline on the backend against config/targets.json."
          action={<AddCompanyDialog onAdded={summary.reload} />}
        />
      ) : summary.data ? (
        <>
          <KpiRow summary={summary.data} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <EvidenceChart summary={summary.data} weeks={Number(weeks)} />
            <NeedsAttention summary={summary.data} />
          </div>
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TopAccounts leads={leads} />
        <RecentSignals signals={signals} />
      </div>
    </>
  );
}

/* --------------------------------------------------------------- KPI row */

function KpiRow({ summary }: { summary: Summary }) {
  const { totals, prior, coverage } = summary;
  const qualified = totals.hot + totals.warm;

  const tiles = [
    {
      label: "Qualified accounts",
      value: fmtInt(qualified),
      delta: fmtDelta(totals.hot, prior.hot),
      note: `${fmtInt(totals.hot)} hot · ${fmtInt(totals.warm)} warm`,
    },
    {
      label: "Average score",
      value: fmtScore(totals.avg_score),
      delta: null,
      // fit_score and intent_score are already stored 0..100 (see src/scoring/score.ts).
      note: `fit ${fmtScore(totals.avg_fit)} · intent ${fmtScore(totals.avg_intent)}`,
    },
    {
      label: "Signals confirmed",
      value: fmtInt(summary.questions.reduce((n, q) => n + q.confirmed, 0)),
      delta: null,
      note: `across ${fmtInt(summary.questions.length)} enabled questions`,
    },
    {
      label: "Evidence documents",
      value: fmtInt(coverage.documents),
      delta: null,
      note: `${fmtInt(coverage.companies)} companies tracked`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="gap-4 p-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">{t.label}</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{t.value}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {t.delta && t.delta.direction !== "flat" && (
              <Badge variant={t.delta.direction === "up" ? "positive" : "warning"}>
                {t.delta.direction === "up" ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {t.delta.label}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{t.note}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- chart */

type Summary = Awaited<ReturnType<typeof api.reportSummary>>;

function EvidenceChart({ summary, weeks }: { summary: Summary; weeks: number }) {
  const data = summary.timeline.map((t) => ({
    week: new Date(t.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    documents: t.documents,
    signals: t.signals,
  }));

  // State the takeaway rather than restating the axes.
  const takeaway = useMemo(() => {
    if (data.length < 2) return "Not enough history yet to show a trend.";
    const half = Math.floor(data.length / 2);
    const first = data.slice(0, half).reduce((n, d) => n + d.signals, 0);
    const last = data.slice(half).reduce((n, d) => n + d.signals, 0);
    if (first === 0 && last === 0) return `No signals were confirmed in the last ${weeks} weeks.`;
    if (first === 0) return `${last} signals confirmed, all of them in the second half of the window.`;
    const pct = Math.round(((last - first) / first) * 100);
    if (Math.abs(pct) < 5) return `Signal volume held steady over the last ${weeks} weeks.`;
    return `Signal volume ${pct > 0 ? "rose" : "fell"} ${Math.abs(pct)}% over the last ${weeks} weeks.`;
  }, [data, weeks]);

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">{takeaway}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Documents ingested and signals confirmed, by week. Both are counts, not estimates.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            Signals
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0 w-4 border-t-2 border-dashed border-[oklch(0.62_0.12_245)]" />
            Documents
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-[260px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nothing has been ingested in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                minTickGap={16}
              />
              <YAxis
                width={36}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <RechartsTooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="signals"
                name="Signals confirmed"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#signalFill)"
              />
              <Line
                type="monotone"
                dataKey="documents"
                name="Documents ingested"
                stroke="oklch(0.62 0.12 245)"
                strokeWidth={2}
                strokeDasharray="3 5"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Recharts' default tooltip ignores the token palette, so this replaces it. */
export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-[0px_8px_20px_-8px_rgba(0,0,0,0.3)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        {payload.map((p) => (
          <p key={String(p.dataKey)} className="flex items-center gap-2 text-sm font-medium tabular-nums">
            <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- needs attention */

function NeedsAttention({ summary }: { summary: Summary }) {
  const { totals, coverage } = summary;
  const items = [
    {
      icon: FileWarning,
      n: coverage.without_evidence,
      label: "companies with no evidence",
      body: "The crawler stored nothing for them, so their score rests on firmographics alone.",
      to: "/sources",
      tone: coverage.without_evidence > 0,
    },
    {
      icon: ShieldAlert,
      n: totals.disqualified,
      label: "disqualified accounts",
      body: "A disqualifying rule fired. Check the rule before writing them off.",
      to: "/leads?band=disqualified",
      tone: totals.disqualified > 0,
    },
  ];

  const clean = items.every((i) => i.n === 0);

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Needs attention</CardTitle>
        <p className="text-sm text-muted-foreground">Problems that quietly cost you leads.</p>
      </CardHeader>
      <CardContent className="gap-4">
        {items.map((i) => (
          <Link
            key={i.label}
            to={i.to}
            className="flex items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-accent"
          >
            <i.icon className={`mt-0.5 size-4 shrink-0 ${i.tone ? "text-destructive" : "text-muted-foreground"}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="tabular-nums">{fmtInt(i.n)}</span> {i.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{i.body}</p>
            </div>
          </Link>
        ))}
        {clean && (
          <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-5 text-muted-foreground">
              Every tracked company has evidence behind its score and nothing is disqualified.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------- bottom panels */

function TopAccounts({ leads }: { leads: ReturnType<typeof useAsync<Awaited<ReturnType<typeof api.leads>>>> }) {
  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg">Top accounts by score</CardTitle>
        <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground">
          <Link to="/leads">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {leads.error ? (
          <p className="text-sm text-muted-foreground">{leads.error}</p>
        ) : leads.loading && leads.firstLoad ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : !leads.data?.length ? (
          <p className="text-sm text-muted-foreground">No scored accounts yet.</p>
        ) : (
          leads.data.map((l) => (
            <Link
              key={l.id}
              to={`/leads/${l.id}`}
              className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0 hover:opacity-80"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-sm font-medium">{l.name}</span>
                <BandChip band={l.band} />
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm font-semibold tabular-nums">
                {fmtScore(l.total)}
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecentSignals({ signals }: { signals: ReturnType<typeof useAsync<RecentSignal[]>> }) {
  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg">Recent signals</CardTitle>
        <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground">
          <Link to="/signals">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="gap-4">
        {signals.error ? (
          <p className="text-sm text-muted-foreground">{signals.error}</p>
        ) : signals.loading && signals.firstLoad ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !signals.data?.length ? (
          <p className="text-sm text-muted-foreground">
            No signals confirmed yet. Run the evaluate step to answer the signal questions.
          </p>
        ) : (
          signals.data.map((s) => (
            <Link key={s.id} to={`/leads/${s.company_id}`} className="flex gap-3 hover:opacity-80">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {s.polarity === "positive" ? <TrendingUp className="size-3.5" /> : <Radio className="size-3.5" />}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">
                  {s.company_name} — {s.question_key.replace(/_/g, " ")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {fmtRelative(s.evaluated_at)}
                  {s.evidence[0]?.url ? ` · ${hostOf(s.evidence[0].url)}` : ""}
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
