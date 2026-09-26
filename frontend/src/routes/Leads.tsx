/**
 * Leads — Screen 2.
 *
 * Sorting, filtering and paging all happen client-side over one fetch. The
 * list is capped at 500 rows by the API, which is well inside what a browser
 * sorts instantly and avoids a round trip per column click.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileWarning, RefreshCw, Search } from "lucide-react";
import { api, BANDS } from "@/api";
import type { Band, Lead } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { BandChip } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/misc";
import { fmtDate, fmtInt, fmtScore } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "name" | "total" | "industry" | "reasons" | "document_count" | "computed_at";
type Direction = "asc" | "desc";

const PAGE_SIZE = 12;

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right"; hint?: string }> = [
  { key: "name", label: "Company" },
  { key: "total", label: "Score", hint: "Weighted fit and intent, 0–100" },
  { key: "industry", label: "Industry" },
  { key: "reasons", label: "Signals", hint: "Confirmed signals quoted in the score breakdown" },
  { key: "document_count", label: "Evidence", align: "right", hint: "Documents stored for this company" },
  { key: "computed_at", label: "Last scored" },
];

const FILTERS: Array<{ id: string; label: string; test: (l: Lead) => boolean }> = [
  { id: "all", label: "All leads", test: () => true },
  { id: "hot", label: "Hot", test: (l) => l.band === "hot" },
  { id: "warm", label: "Warm", test: (l) => l.band === "warm" },
  { id: "review", label: "Needs review", test: (l) => l.document_count === 0 && !l.disqualified },
  { id: "disqualified", label: "Disqualified", test: (l) => l.disqualified },
];

export function Leads() {
  const gate = useServiceGate();
  const { serviceKey, service } = useWorkspace();
  const [params, setParams] = useSearchParams();

  const leads = useAsync(() => api.leads({ service: serviceKey, limit: 500 }), [serviceKey], Boolean(serviceKey));

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(() => (BANDS.includes(params.get("band") as Band) ? params.get("band")! : "all"));
  const [sort, setSort] = useState<{ key: SortKey; dir: Direction }>({ key: "total", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // A ?band= link from the Overview should land on the matching filter chip.
  useEffect(() => {
    const band = params.get("band");
    if (band && FILTERS.some((f) => f.id === band)) setFilter(band);
  }, [params]);

  useEffect(() => setPage(0), [query, filter, serviceKey]);

  const rows = leads.data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter)?.test ?? (() => true);
    return rows.filter(
      (l) =>
        test(l) &&
        (!needle || l.name.toLowerCase().includes(needle) || l.domain.toLowerCase().includes(needle)),
    );
  }, [rows, query, filter]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const value = (l: Lead) => {
      switch (sort.key) {
        case "name":
          return l.name.toLowerCase();
        case "industry":
          return (l.industry ?? "").toLowerCase();
        case "reasons":
          return l.top_reasons.length;
        case "document_count":
          return l.document_count;
        case "computed_at":
          return l.computed_at ? new Date(l.computed_at).getTime() : 0;
        default:
          return l.total;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === bv) return a.name.localeCompare(b.name);
      return (av > bv ? 1 : -1) * dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const allVisibleSelected = visible.length > 0 && visible.every((l) => selected.has(l.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((l) => next.delete(l.id));
      else visible.forEach((l) => next.add(l.id));
      return next;
    });

  const exportSelected = () => {
    const chosen = sorted.filter((l) => selected.has(l.id));
    const cols = ["name", "domain", "country", "industry", "employee_count", "total", "band", "fit_score", "intent_score", "penalty", "disqualified", "computed_at"] as const;
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...chosen.map((l) => cols.map((c) => cell(l[c])).join(","))].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `orange-signal-${serviceKey}-selection.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          leads.data
            ? `${fmtInt(rows.length)} scored accounts for ${service?.name ?? "this service"}, ranked by weighted fit and intent.`
            : "Ranked by weighted fit and intent."
        }
        actions={
          <>
            <Button variant="outline" onClick={leads.reload} disabled={leads.loading}>
              <RefreshCw className={cn("size-4", leads.loading && "animate-spin")} />
              Refresh
            </Button>
            <AddCompanyDialog onAdded={leads.reload} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company or domain"
            className="w-[300px] pl-9"
            aria-label="Search leads"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const n = rows.filter(f.test).length;
            return (
              <Button
                key={f.id}
                variant={filter === f.id ? "default" : "secondary"}
                size="sm"
                onClick={() => {
                  setFilter(f.id);
                  setParams(f.id === "all" ? {} : { band: f.id }, { replace: true });
                }}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {leads.error ? (
        <ErrorState error={leads.error} what="leads" onRetry={leads.reload} />
      ) : leads.loading && leads.firstLoad ? (
        <Loading label="Loading leads" rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No scored leads for this service"
          body="Add a prospect to run the pipeline for one company, or run npm run pipeline on the backend to process your whole target list."
          action={<AddCompanyDialog onAdded={leads.reload} />}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches those filters"
          body={query ? `No company matches “${query}” in the ${filter === "all" ? "full list" : filter} view.` : "Try a different filter."}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setParams({}, { replace: true });
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Scored leads, sortable by column. {sorted.length} rows across {pageCount} pages.
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                  <th scope="col" className="w-14 px-6 py-4">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAllVisible}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={cn("px-4 py-4", c.align === "right" && "text-right")}>
                      <SortButton
                        column={c}
                        sort={sort}
                        onSort={(key) =>
                          setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))
                        }
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-6 py-4">
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggle(l.id)}
                        aria-label={`Select ${l.name}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link to={`/leads/${l.id}`} className="flex flex-col gap-0.5">
                        <span className="font-medium hover:underline">{l.name}</span>
                        <span className="text-xs text-muted-foreground">{l.domain}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-lg px-3 py-1.5 text-base font-bold tabular-nums",
                            l.disqualified
                              ? "bg-muted text-muted-foreground line-through decoration-1"
                              : l.band === "hot"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted",
                          )}
                        >
                          {fmtScore(l.total)}
                        </span>
                        <BandChip band={l.band} />
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{l.industry ?? "—"}</td>
                    <td className="max-w-[320px] px-4 py-4">
                      {l.top_reasons.length === 0 ? (
                        <span className="text-sm text-muted-foreground">none confirmed</span>
                      ) : (
                        <Tooltip label={l.top_reasons.join(" · ")}>
                          <span className="flex items-center gap-2 text-sm">
                            <Badge variant="muted">{l.top_reasons.length}</Badge>
                            <span className="truncate text-muted-foreground">{l.top_reasons[0]}</span>
                          </span>
                        </Tooltip>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums">
                      {l.document_count === 0 ? (
                        <Tooltip label="No documents stored — this score rests on firmographics alone">
                          <span className="inline-flex items-center gap-1.5 text-destructive">
                            <FileWarning className="size-3.5" />0
                          </span>
                        </Tooltip>
                      ) : (
                        fmtInt(l.document_count)
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{fmtDate(l.computed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CardFooter className="flex-wrap justify-between gap-4 border-t border-border p-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={exportSelected} disabled={selected.size === 0}>
                <Download className="size-4" />
                Export {selected.size > 0 ? `${selected.size} selected` : "selected"}
              </Button>
              {selected.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="mr-2 text-sm text-muted-foreground tabular-nums">
                {page * PAGE_SIZE + 1}–{Math.min(sorted.length, (page + 1) * PAGE_SIZE)} of {sorted.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pageCount - 1}
              >
                Next
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

function SortButton({
  column,
  sort,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  sort: { key: SortKey; dir: Direction };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  const button = (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
      aria-label={`Sort by ${column.label}`}
    >
      {column.label}
      <Icon className="size-3.5" />
    </button>
  );

  return column.hint ? <Tooltip label={column.hint}>{button}</Tooltip> : button;
}
