/**
 * Data sources — Screen 6.
 *
 * The comp listed third-party SaaS connectors with fake "Connected" badges.
 * This platform has no connectors: it has four ingest adapters that either ran
 * or did not. So each card is one adapter, its switch genuinely stops the
 * crawler touching that source on the next run (see src/pipeline/ingest.ts),
 * and "sync health" is the real success rate from the crawl log.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Database,
  Globe,
  Newspaper,
  Play,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/api";
import type { CrawlLogEntry, CrawlProgress, SourceHealth, SourceKind } from "@/api";
import { useAsync } from "@/hooks";
import { useServiceGate } from "@/components/ServiceGate";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, EmptyState, Banner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/misc";
import { fmtDateTime, fmtInt, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<SourceKind, { label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  firmographics: {
    label: "Firmographics",
    icon: Database,
    blurb: "Wikidata, an optional Crunchbase export and the company homepage. Feeds ICP fit.",
  },
  jobs: {
    label: "Hiring",
    icon: BriefcaseBusiness,
    blurb: "Each applicant tracking system's own public JSON API, not scraped careers pages.",
  },
  news: {
    label: "News",
    icon: Newspaper,
    blurb: "GDELT for full article text, Google News for headline-level coverage.",
  },
  website: {
    label: "Owned pages",
    icon: Globe,
    blurb: "Newsroom, strategy and about pages from the company's own domain.",
  },
};

/**
 * Tracks a crawl started from this screen.
 *
 * The run outlives the request that started it, so the state lives on the
 * server and this polls it. It also reads the state once on mount, which means
 * reloading the page - or opening the screen in a second tab - picks up a crawl
 * already in flight rather than offering to start a competing one.
 */
function useCrawl(onFinished: () => void) {
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref so changing the callback does not restart the poll timer.
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    let alive = true;
    api.crawl().then((p) => alive && setProgress(p)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const running = progress?.status === "running";

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.crawl();
        setProgress(next);
        if (next.status !== "running") finished.current();
      } catch {
        // A dropped poll is not worth surfacing; the next tick retries.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [running]);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      setProgress(await api.startCrawl());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }, []);

  return { progress, running, starting, error, start };
}

/** Progress line while a crawl runs, and the tally once it finishes. */
function CrawlBanner({ progress }: { progress: CrawlProgress }) {
  if (progress.status === "idle") return null;

  if (progress.status === "running") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <Banner tone="info">
        <div className="flex flex-col gap-2">
          <span>
            Crawling {progress.current ?? "…"} — {fmtInt(progress.done)} of {fmtInt(progress.total)} companies,{" "}
            {fmtInt(progress.documents_added)} new documents so far. This takes a few minutes: the crawler obeys
            robots.txt and spaces its requests.
          </span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Banner>
    );
  }

  const failed = progress.results.filter((r) => r.error);
  const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

  return (
    <Banner tone={progress.status === "failed" || failed.length ? "error" : "ok"}>
      {progress.status === "failed"
        ? `The crawl stopped: ${progress.error}`
        : `Crawled ${plural(progress.results.length, "company", "companies")} and stored ` +
          `${plural(progress.documents_added, "new document")}.` +
          (failed.length ? ` ${plural(failed.length, "failed")}: ${failed.map((f) => f.company).join(", ")}.` : "") +
          " Run evaluate and score to turn new evidence into signals."}
    </Banner>
  );
}

export function Sources() {
  const gate = useServiceGate();
  const sources = useAsync(() => api.sources(), []);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const crawl = useCrawl(sources.reload);

  const toggle = async (kind: SourceKind, enabled: boolean) => {
    const before = sources.data;
    sources.setData((prev) =>
      prev ? { ...prev, sources: prev.sources.map((s) => (s.source_kind === kind ? { ...s, enabled } : s)) } : prev,
    );
    try {
      await api.setSourceEnabled(kind, enabled);
      setNotice({
        tone: "ok",
        text: enabled
          ? `${SOURCE_META[kind].label} will be crawled again from the next ingest run.`
          : `${SOURCE_META[kind].label} is off. Existing documents stay; the crawler just stops fetching new ones.`,
      });
    } catch (e) {
      sources.setData(before ?? null);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Data sources"
        description="Where the evidence comes from, whether it is arriving, and what failed. A thin evidence base is the usual reason a promising company scores low."
        actions={
          <>
            <Button variant="outline" onClick={sources.reload} disabled={sources.loading}>
              <RefreshCw className={cn("size-4", sources.loading && "animate-spin")} />
              Refresh
            </Button>
            <Tooltip
              label={
                crawl.running
                  ? "A crawl is already running"
                  : "Re-crawl every tracked company using the sources switched on below"
              }
            >
              <Button variant="outline" onClick={crawl.start} disabled={crawl.running || crawl.starting}>
                <Play className={cn("size-4", (crawl.running || crawl.starting) && "animate-pulse")} />
                {crawl.running ? "Crawling…" : crawl.starting ? "Starting…" : "Crawl now"}
              </Button>
            </Tooltip>
            <AddCompanyDialog
              trigger={<Button>Add a prospect</Button>}
              onAdded={sources.reload}
            />
          </>
        }
      />

      {crawl.error && <Banner tone="error">{crawl.error}</Banner>}
      {crawl.progress && <CrawlBanner progress={crawl.progress} />}
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {sources.error ? (
        <ErrorState error={sources.error} what="source health" onRetry={sources.reload} />
      ) : sources.loading && sources.firstLoad ? (
        <Loading label="Reading the crawl log" rows={4} />
      ) : sources.data ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            {sources.data.sources.map((s) => (
              <SourceCard key={s.source_kind} source={s} onToggle={toggle} />
            ))}
          </div>
          <SyncHealth hourly={sources.data.hourly} sources={sources.data.sources} />
        </div>
      ) : null}

      <CrawlLog />
    </>
  );
}

function SourceCard({
  source: s,
  onToggle,
}: {
  source: SourceHealth;
  onToggle: (kind: SourceKind, enabled: boolean) => void;
}) {
  const meta = SOURCE_META[s.source_kind];
  const Icon = meta.icon;
  const attempted = s.attempts_24h > 0;
  const rate = attempted ? s.ok_24h / s.attempts_24h : null;

  return (
    <Card className={cn("gap-4 p-6", !s.enabled && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-medium">{meta.label}</h3>
            <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">{meta.blurb}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {!s.enabled ? (
                <Badge variant="muted">Off</Badge>
              ) : s.failed_24h > 0 ? (
                <Badge variant="critical">
                  <TriangleAlert className="size-3" />
                  {s.failed_24h} failed in 24h
                </Badge>
              ) : s.documents > 0 ? (
                <Badge variant="positive">Collecting</Badge>
              ) : (
                <Badge variant="warning">Nothing stored yet</Badge>
              )}
              <span>
                {s.last_fetch ? `Last fetch ${fmtRelative(s.last_fetch)}` : "Never fetched"}
              </span>
            </div>
          </div>
        </div>

        <Tooltip label={s.enabled ? "Stop crawling this source" : "Crawl this source again"}>
          <span className="inline-block">
            <Switch
              checked={s.enabled}
              onCheckedChange={(v) => onToggle(s.source_kind, v)}
              aria-label={`${meta.label} enabled`}
            />
          </span>
        </Tooltip>
      </div>

      {s.last_error && s.enabled && (
        <p className="rounded-lg bg-destructive/8 px-3 py-2 text-xs leading-5 text-destructive">
          Last error: {s.last_error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Stat label="documents" value={fmtInt(s.documents)} />
          <Stat label="companies" value={fmtInt(s.companies)} />
          {rate !== null && <Stat label="ok in 24h" value={`${Math.round(rate * 100)}%`} />}
        </div>
        {s.adapters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.adapters.slice(0, 4).map((a) => (
              <Tooltip key={a.name} label={`${fmtInt(a.documents)} documents · last ${fmtRelative(a.last_fetch)}`}>
                <span>
                  <Badge variant="outline">{a.name}</Badge>
                </span>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------ sync health */

function SyncHealth({
  hourly,
  sources,
}: {
  hourly: Array<{ hour: string; ok: number; failed: number }>;
  sources: SourceHealth[];
}) {
  const attempts = sources.reduce((n, s) => n + s.attempts_24h, 0);
  const ok = sources.reduce((n, s) => n + s.ok_24h, 0);
  const rate = attempts > 0 ? ok / attempts : null;

  // The API only returns hours that saw traffic. Pad to a full 24 slots so the
  // strip always reads as a day — two busy hours should look like two bars in a
  // day, not like a day that was busy throughout.
  const buckets = useMemo(() => {
    const byHour = new Map(hourly.map((h) => [new Date(h.hour).setMinutes(0, 0, 0), h]));
    const top = new Date().setMinutes(0, 0, 0);
    return Array.from({ length: 24 }, (_, i) => {
      const at = top - (23 - i) * 3_600_000;
      const hit = byHour.get(at);
      return { at, ok: hit?.ok ?? 0, failed: hit?.failed ?? 0 };
    });
  }, [hourly]);

  const max = Math.max(1, ...buckets.map((h) => h.ok + h.failed));

  return (
    <Card className="h-fit gap-6 p-6 xl:sticky xl:top-[116px]">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-base">Sync health</CardTitle>
        <p className="text-sm text-muted-foreground">Fetch attempts over the last 24 hours.</p>
      </CardHeader>
      <CardContent className="gap-5">
        {attempts === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has been crawled in the last 24 hours, so there is no health to report. Add a prospect or run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run ingest</code> on the backend.
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {((rate ?? 0) * 100).toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">
                {fmtInt(ok)} of {fmtInt(attempts)} succeeded
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(rate ?? 0) * 100}%` }} />
            </div>

            <div>
              <div className="flex h-24 items-end gap-1" role="img" aria-label="Hourly fetch attempts over the last 24 hours">
                {buckets.map((h) => {
                  const total = h.ok + h.failed;
                  const hour = new Date(h.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Tooltip
                      key={h.at}
                      label={total === 0 ? `${hour}: nothing crawled` : `${hour}: ${h.ok} ok, ${h.failed} failed`}
                    >
                      <div className="flex h-full flex-1 flex-col justify-end gap-px">
                        {h.failed > 0 && (
                          <div
                            className="rounded-t-sm bg-destructive"
                            style={{ height: `${(h.failed / max) * 100}%`, minHeight: 2 }}
                          />
                        )}
                        <div
                          className={cn(
                            h.failed === 0 && "rounded-t-sm",
                            total === 0 ? "bg-muted" : "bg-primary/80",
                          )}
                          style={{
                            height: total === 0 ? 2 : `${(h.ok / max) * 100}%`,
                            minHeight: 2,
                          }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>24h ago</span>
                <span>now</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- crawl log */

function CrawlLog() {
  const [limit, setLimit] = useState("100");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const log = useAsync(() => api.crawlLog(Number(limit)), [limit]);

  const rows = log.data ?? [];
  const shown = useMemo(() => (onlyProblems ? rows.filter((r) => r.status !== "ok") : rows), [rows, onlyProblems]);
  const failures = rows.filter((r) => r.status !== "ok").length;

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">Crawl log</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length > 0
              ? `${failures} of the last ${rows.length} fetch attempts did not succeed.`
              : "Every fetch attempt, successful or not."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Switch checked={onlyProblems} onCheckedChange={setOnlyProblems} />
            Only problems
          </label>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="h-9 w-[120px]" aria-label="Log size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["50", "100", "250", "500"].map((n) => (
                <SelectItem key={n} value={n}>
                  last {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={log.reload}>
            <RefreshCw className={cn("size-3.5", log.loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {log.error ? (
          <ErrorState error={log.error} what="the crawl log" onRetry={log.reload} />
        ) : log.loading && log.firstLoad ? (
          <Loading label="Loading the crawl log" rows={3} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={onlyProblems ? "No failures recorded" : "The crawl log is empty"}
            body={
              onlyProblems
                ? "Every recent fetch attempt succeeded."
                : "Nothing has been crawled yet. Add a prospect to run the pipeline for one company."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Recent crawl attempts</caption>
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th scope="col" className="py-3 pr-4">When</th>
                  <th scope="col" className="py-3 pr-4">Source</th>
                  <th scope="col" className="py-3 pr-4">Target</th>
                  <th scope="col" className="py-3 pr-4">Status</th>
                  <th scope="col" className="py-3 pr-4 text-right">Docs</th>
                  <th scope="col" className="py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <LogRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ row }: { row: CrawlLogEntry }) {
  const variant = row.status === "ok" ? "positive" : row.status === "not_found" ? "warning" : "critical";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">{fmtDateTime(row.at)}</td>
      <td className="py-3 pr-4">{row.source_name}</td>
      <td className="max-w-[260px] py-3 pr-4">
        <span className="block truncate text-muted-foreground" title={row.url}>
          {row.url || "—"}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Badge variant={variant}>{row.status}</Badge>
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{fmtInt(row.docs_added)}</td>
      <td className="max-w-[380px] py-3">
        <span className="block truncate text-muted-foreground" title={row.detail ?? ""}>
          {row.detail ?? "—"}
        </span>
      </td>
    </tr>
  );
}
