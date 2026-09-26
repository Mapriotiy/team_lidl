/**
 * Reports — Screen 8.
 *
 * Bars start at zero, there is one y-axis, rankings are sorted, and every
 * series is a count of stored rows. Where the comp showed revenue this shows
 * the things the platform can actually measure: score distribution, which
 * questions earn their keep, and which segments qualify.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download, Plus, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api";
import type { ReportSchedule, ReportSummary } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { PageHeader } from "@/components/PageHeader";
import { ChartTooltip } from "@/routes/Overview";
import { Loading, ErrorState, EmptyState, Banner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label, Meter, Tooltip } from "@/components/ui/misc";
import { fmtDate, fmtDelta, fmtInt, fmtPct, fmtScore } from "@/lib/format";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { value: "4", label: "Last 4 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "26", label: "Last 26 weeks" },
  { value: "52", label: "Last 52 weeks" },
];

export function Reports() {
  const gate = useServiceGate();
  const { serviceKey, service } = useWorkspace();
  const [weeks, setWeeks] = useState("12");

  const summary = useAsync(
    () => api.reportSummary(serviceKey, Number(weeks)),
    [serviceKey, weeks],
    Boolean(serviceKey),
  );

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`What the evidence base looks like for ${service?.name ?? "this service"}, and which signals are earning their weight.`}
        actions={
          <>
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger className="w-[168px]" aria-label="Reporting window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    <span className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 text-muted-foreground" />
                      {w.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <a href={api.exportUrl(serviceKey)} download>
                <Download className="size-4" />
                Export CSV
              </a>
            </Button>
          </>
        }
      />

      {summary.error ? (
        <ErrorState error={summary.error} what="the report" onRetry={summary.reload} />
      ) : summary.loading && summary.firstLoad ? (
        <Loading label="Building the report" rows={5} />
      ) : !summary.data || summary.data.totals.scored === 0 ? (
        <EmptyState
          title="Nothing to report yet"
          body="No company has been scored for this service, so every chart would be empty. Run the pipeline first."
        />
      ) : (
        <>
          <KpiRow summary={summary.data} />
          <ScoreDistribution summary={summary.data} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <QuestionPerformance summary={summary.data} />
            <TopSegments summary={summary.data} />
          </div>
        </>
      )}

      <Schedules />
    </>
  );
}

/* --------------------------------------------------------------- KPI row */

function KpiRow({ summary }: { summary: ReportSummary }) {
  const { totals, prior, coverage } = summary;
  const qualified = totals.hot + totals.warm;
  const confirmRate = summary.questions.reduce((n, q) => n + q.confirmed, 0);

  const tiles = [
    { label: "Scored accounts", value: fmtInt(totals.scored), delta: fmtDelta(totals.scored, prior.scored) },
    { label: "Qualified (hot + warm)", value: fmtInt(qualified), delta: fmtDelta(totals.hot, prior.hot) },
    { label: "Average score", value: fmtScore(totals.avg_score), delta: null },
    {
      label: "Evidence per account",
      value: coverage.companies > 0 ? (coverage.documents / coverage.companies).toFixed(1) : "—",
      delta: null,
      note: `${fmtInt(confirmRate)} signals confirmed`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="gap-3 p-5">
          <p className="text-sm text-muted-foreground">{t.label}</p>
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
            {t.delta && t.delta.direction !== "flat" && (
              <span
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  t.delta.direction === "up" ? "text-[oklch(0.45_0.13_155)]" : "text-destructive",
                )}
              >
                {t.delta.direction === "up" ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownRight className="size-4" />
                )}
                {t.delta.label}
              </span>
            )}
          </div>
          {"note" in t && t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------- score distribution */

function ScoreDistribution({ summary }: { summary: ReportSummary }) {
  const data = useMemo(() => {
    const byDecile = new Map(summary.distribution.map((d) => [d.decile, d.n]));
    return Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}–${i * 10 + 9}`,
      accounts: byDecile.get(i) ?? 0,
      hot: i >= 7,
    }));
  }, [summary.distribution]);

  const total = data.reduce((n, d) => n + d.accounts, 0);
  const hot = data.filter((d) => d.hot).reduce((n, d) => n + d.accounts, 0);

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">
            {total === 0
              ? "No scored accounts"
              : `${fmtPct(hot / total)} of scored accounts clear the hot threshold`}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Accounts per 10-point score band. Excludes disqualified accounts, which are forced to zero.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          Hot (70+)
        </span>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="range"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              width={36}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent)" }} />
            <Bar dataKey="accounts" name="Accounts" radius={[6, 6, 0, 0]} fill="var(--muted-foreground)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------- question performance */

function QuestionPerformance({ summary }: { summary: ReportSummary }) {
  const rows = [...summary.questions].sort((a, b) => b.confirmed - a.confirmed);
  const max = Math.max(1, ...rows.map((r) => r.confirmed));
  const dead = rows.filter((r) => r.confirmed === 0);

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Which questions earn their weight</CardTitle>
        <p className="text-sm text-muted-foreground">
          Companies where each enabled question was confirmed, ranked.
          {dead.length > 0 && ` ${dead.length} never fired — worth rewording or retiring.`}
        </p>
      </CardHeader>
      <CardContent className="gap-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enabled questions for this service.</p>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="flex items-center gap-4">
              <Tooltip label={r.text}>
                <span className="w-40 shrink-0 truncate text-sm">{r.key.replace(/_/g, " ")}</span>
              </Tooltip>
              <Meter
                value={r.confirmed / max}
                label={r.key}
                className="h-3"
                barClassName={r.polarity === "positive" ? undefined : "bg-destructive"}
              />
              <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{fmtInt(r.confirmed)}</span>
            </div>
          ))
        )}
        <Button asChild variant="outline" size="sm" className="mt-1 self-start">
          <Link to="/signals">Tune the questions</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------- top segments */

function TopSegments({ summary }: { summary: ReportSummary }) {
  const rows = summary.segments;
  const qualifiedTotal = rows.reduce((n, s) => n + s.qualified, 0);
  // With nothing qualified yet, a "share of qualified" chart would be all
  // zeroes, so fall back to counting scored accounts and say which it is.
  const anyQualified = qualifiedTotal > 0;

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">
          {anyQualified ? "Where qualified accounts come from" : "Scored accounts by industry"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {anyQualified
            ? "Share of hot and warm accounts by industry, sorted."
            : "No account has reached the warm band yet, so this counts scored accounts instead."}{" "}
          “Unclassified” means firmographics found no industry.
        </p>
      </CardHeader>
      <CardContent className="gap-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No non-disqualified accounts to segment.</p>
        ) : (
          rows.map((s, i) => (
            <div key={s.industry} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.industry}</span>
              <Tooltip label={`${s.n} scored · ${s.qualified} qualified · average ${fmtScore(s.avg_score)}`}>
                <span>
                  <Badge variant={i === 0 ? "default" : "muted"} className="tabular-nums">
                    {anyQualified ? fmtPct(s.qualified / qualifiedTotal) : `${s.n} scored`}
                  </Badge>
                </span>
              </Tooltip>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- schedules */

function Schedules() {
  const schedules = useAsync(() => api.reportSchedules(), []);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const rows = schedules.data ?? [];

  const toggle = async (s: ReportSchedule, enabled: boolean) => {
    const before = rows;
    schedules.setData((prev) => (prev ?? []).map((r) => (r.id === s.id ? { ...r, enabled } : r)));
    try {
      await api.setReportScheduleEnabled(s.id, enabled);
    } catch (e) {
      schedules.setData(before);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = async (s: ReportSchedule) => {
    if (!window.confirm(`Delete the schedule "${s.name}"?`)) return;
    const before = rows;
    schedules.setData((prev) => (prev ?? []).filter((r) => r.id !== s.id));
    try {
      await api.deleteReportSchedule(s.id);
    } catch (e) {
      schedules.setData(before);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">Report schedules</CardTitle>
          <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
            Saved recipient lists and cadences. The dashboard stores them; a delivery job has to read{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">report_schedules</code> and send — nothing is
            emailed from here yet.
          </p>
        </div>
        <ScheduleDialog onCreated={(s) => schedules.setData((prev) => [s, ...(prev ?? [])])} />
      </CardHeader>

      <CardContent className="gap-3">
        {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

        {schedules.error ? (
          <p className="text-sm text-destructive">{schedules.error}</p>
        ) : schedules.loading && schedules.firstLoad ? (
          <p className="text-sm text-muted-foreground">Loading schedules…</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No schedules yet. Create one to record who should receive this report and how often.
          </p>
        ) : (
          rows.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4",
                !s.enabled && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{s.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.cadence} · {s.service_name ?? "all services"} ·{" "}
                  {s.recipients.length ? s.recipients.join(", ") : "no recipients"}
                  {s.last_run_at ? ` · last sent ${fmtDate(s.last_run_at)}` : " · never sent"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => toggle(s, v)}
                  aria-label={`${s.name} enabled`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(s)}
                  aria-label={`Delete ${s.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleDialog({ onCreated }: { onCreated: (s: ReportSchedule) => void }) {
  const { services, serviceKey } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<ReportSchedule["cadence"]>("weekly");
  const [recipients, setRecipients] = useState("");
  const [scope, setScope] = useState(serviceKey || "all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emails = recipients
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = emails.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  const valid = name.trim().length > 0 && bad.length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await api.createReportSchedule({
          name: name.trim(),
          cadence,
          recipients: emails,
          service: scope === "all" ? undefined : scope,
        }),
      );
      setName("");
      setRecipients("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>
        <Button variant="outline">
          <Plus className="size-4" />
          Schedule report
        </Button>
      </span>

      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Schedule a report</DialogTitle>
            <DialogDescription>
              Records the cadence and recipients. Wiring up delivery is a backend job that reads this table.
            </DialogDescription>
          </DialogHeader>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="sch-name">Name</Label>
            <Input
              id="sch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Monday pipeline digest"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as ReportSchedule["cadence"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["daily", "weekly", "monthly"] as const).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {(services.data ?? []).map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sch-to">Recipients</Label>
            <Input
              id="sch-to"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="sales@orange.systems, lead@orange.systems"
            />
            <p className={cn("text-xs", bad.length ? "text-destructive" : "text-muted-foreground")}>
              {bad.length ? `Not an email address: ${bad.join(", ")}` : "Comma or space separated."}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Saving…" : "Create schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
