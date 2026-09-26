/**
 * ICP & Scoring — Screen 5.
 *
 * The comp put "signal weights" and a live "score preview" side by side. Both
 * are real here: weights are the same rows the Signals screen edits, and the
 * preview recomputes the fit half of the formula from the draft profile in the
 * browser using the same rules as src/scoring/score.ts, so you can see the
 * effect before committing to a re-score.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Save, X } from "lucide-react";
import { api, num } from "@/api";
import type { IcpProfile, Lead } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, Banner } from "@/components/states";
import { ScoreRing } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldLabel, Label, Meter, Tooltip } from "@/components/ui/misc";
import { fmtInt, fmtScore } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Draft {
  name: string;
  countries: string[];
  industries: string[];
  exclude_industries: string[];
  min_employees: string;
  max_employees: string;
  fit_weight: number;
}

const toDraft = (icp: IcpProfile | null): Draft => ({
  name: icp?.name ?? "Default ICP",
  countries: icp?.countries ?? [],
  industries: icp?.industries ?? [],
  exclude_industries: icp?.exclude_industries ?? [],
  min_employees: icp?.min_employees == null ? "" : String(icp.min_employees),
  max_employees: icp?.max_employees == null ? "" : String(icp.max_employees),
  fit_weight: icp?.fit_weight ?? 0.3,
});

export function Icp() {
  const gate = useServiceGate();
  const { serviceKey, service } = useWorkspace();

  const icp = useAsync(() => api.icp(serviceKey), [serviceKey], Boolean(serviceKey));
  const leads = useAsync(() => api.leads({ service: serviceKey, limit: 500 }), [serviceKey], Boolean(serviceKey));

  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!icp.loading) {
      setDraft(toDraft(icp.data));
      setDirty(false);
    }
  }, [icp.data, icp.loading]);

  useEffect(() => setNotice(null), [serviceKey]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const minN = draft.min_employees === "" ? null : num(draft.min_employees);
  const maxN = draft.max_employees === "" ? null : num(draft.max_employees);
  const rangeInvalid = minN !== null && maxN !== null && minN > maxN;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rangeInvalid || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.saveIcp(serviceKey, {
        name: draft.name.trim() || "Default ICP",
        countries: draft.countries,
        industries: draft.industries,
        exclude_industries: draft.exclude_industries,
        min_employees: minN === null ? null : Math.max(0, Math.round(minN)),
        max_employees: maxN === null ? null : Math.max(0, Math.round(maxN)),
        fit_weight: draft.fit_weight,
      });
      setNotice({ tone: "ok", text: "Profile saved. Re-score to apply it to existing leads." });
      setDirty(false);
      icp.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const rescore = async () => {
    setRescoring(true);
    setNotice(null);
    try {
      const res = await api.rescore(serviceKey);
      setNotice({ tone: "ok", text: `Re-scored ${num(res?.rescored)} companies with the saved ICP.` });
      leads.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setRescoring(false);
    }
  };

  if (gate) return <>{gate}</>;

  if (icp.error) {
    return (
      <>
        <PageHeader title="ICP & Scoring" />
        <ErrorState error={icp.error} what="the ICP" onRetry={icp.reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="ICP & Scoring"
        description={`The firmographic half of the score for ${service?.name ?? "this service"}. Blank fields are not tested — a company with unknown data scores neutral rather than zero.`}
        actions={
          <>
            <Button variant="outline" onClick={rescore} disabled={rescoring || saving}>
              {rescoring ? "Re-scoring…" : "Re-score all"}
            </Button>
            <Button onClick={save} disabled={saving || rangeInvalid || !dirty}>
              <Save className="size-4" />
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </>
        }
      />

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
      {!icp.data && !icp.loading && (
        <Banner>
          No ICP is configured for this service, so every company currently scores a neutral 0.5 on fit. Fill this in
          and save to create one.
        </Banner>
      )}

      {icp.loading && icp.firstLoad ? (
        <Loading label="Loading the profile" rows={4} />
      ) : (
        <form onSubmit={save} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <Card className="gap-6 p-6">
              <CardHeader className="gap-1.5">
                <CardTitle className="text-lg">Profile</CardTitle>
                <p className="text-sm text-muted-foreground">Who you are trying to reach.</p>
              </CardHeader>
              <CardContent className="gap-5">
                <Row label="Profile name" hint="Shown on the lead detail screen next to the fit score.">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} className="h-9" />
                </Row>

                <Row
                  label="Employee range"
                  hint={
                    rangeInvalid
                      ? "The minimum is above the maximum — no company can match."
                      : "Leave either side blank for open-ended."
                  }
                  tone={rangeInvalid ? "error" : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="min"
                      value={draft.min_employees}
                      onChange={(e) => set("min_employees", e.target.value)}
                      className="h-9"
                      aria-label="Minimum employees"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="max"
                      value={draft.max_employees}
                      onChange={(e) => set("max_employees", e.target.value)}
                      className="h-9"
                      aria-label="Maximum employees"
                    />
                  </div>
                </Row>

                <Row label="Countries" hint="Matched exactly against the company's country, case-insensitively.">
                  <TagField values={draft.countries} onChange={(v) => set("countries", v)} placeholder="Moldova, Romania, Germany" />
                </Row>

                <Row label="Target industries" hint="Substring match either way, so “fintech” matches “Fintech SaaS”.">
                  <TagField values={draft.industries} onChange={(v) => set("industries", v)} placeholder="fintech, logistics, healthcare" />
                </Row>

                <Row
                  label="Excluded industries"
                  hint="A match here forces fit to zero, whatever else lines up. Use it for sectors you cannot sell to."
                >
                  <TagField
                    values={draft.exclude_industries}
                    onChange={(v) => set("exclude_industries", v)}
                    placeholder="gambling, defence"
                    tone="negative"
                  />
                </Row>
              </CardContent>
            </Card>

            <Card className="gap-6 p-6">
              <CardHeader className="gap-1.5">
                <CardTitle className="text-lg">Fit weight</CardTitle>
                <p className="text-sm text-muted-foreground">
                  How much of the total comes from who a company is, rather than what it is doing right now.
                </p>
              </CardHeader>
              <CardContent className="gap-4">
                <div className="flex items-center gap-5">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft.fit_weight}
                    onChange={(e) => set("fit_weight", num(e.target.value, 0.3))}
                    className="h-2 w-full max-w-md cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
                    aria-label="Fit weight"
                  />
                  <span className="text-xl font-semibold tabular-nums">{draft.fit_weight.toFixed(2)}</span>
                </div>
                <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
                  {Math.round(draft.fit_weight * 100)}% firmographic fit, {Math.round((1 - draft.fit_weight) * 100)}%
                  live intent. Raise it when your service only suits a narrow firmographic; lower it when what a
                  company is doing right now matters more.
                </p>
              </CardContent>
            </Card>

            <SignalWeights serviceKey={serviceKey} />
          </div>

          <ScorePreview draft={draft} leads={leads.data ?? []} loading={leads.loading && leads.firstLoad} />
        </form>
      )}
    </>
  );
}

function Row({
  label,
  hint,
  tone,
  children,
}: {
  label: string;
  hint?: string;
  tone?: "error";
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border pb-5 last:border-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <Label className="pt-2">{label}</Label>
      <div className="flex flex-col gap-1.5">
        {children}
        {hint && (
          <p className={cn("text-xs leading-5", tone === "error" ? "text-destructive" : "text-muted-foreground")}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- tag editor */

function TagField({
  values,
  onChange,
  placeholder,
  tone,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  tone?: "negative";
}) {
  const [text, setText] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...values, ...parts]);
    setText("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={text}
        placeholder={placeholder}
        className="h-9"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(text);
          }
          if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                tone === "negative" ? "bg-destructive/12 text-destructive" : "bg-secondary text-secondary-foreground",
              )}
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Press Enter or comma to add.</p>
    </div>
  );
}

/* --------------------------------------------------------- signal weights */

function SignalWeights({ serviceKey }: { serviceKey: string }) {
  const questions = useAsync(() => api.questions(serviceKey), [serviceKey], Boolean(serviceKey));
  const rows = (questions.data ?? []).filter((q) => q.polarity === "positive" && q.enabled);
  const points = { high: 3, medium: 2, low: 1 } as const;
  const total = rows.reduce((n, q) => n + points[q.weight], 0);

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">Signal weights</CardTitle>
          <p className="text-sm text-muted-foreground">
            The intent half. {total} weight points are available to win across {rows.length} enabled positive
            questions.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/signals">Edit on Signals</Link>
        </Button>
      </CardHeader>
      <CardContent className="gap-4">
        {questions.loading && questions.firstLoad ? (
          <p className="text-sm text-muted-foreground">Loading questions…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No enabled positive questions, so intent always scores zero. Add one on the Signals screen.
          </p>
        ) : (
          rows.map((q) => (
            <div key={q.id} className="flex items-center gap-4">
              <Tooltip label={q.text}>
                <span className="w-44 shrink-0 truncate text-sm">{q.key.replace(/_/g, " ")}</span>
              </Tooltip>
              <Meter value={points[q.weight] / 3} label={q.key} />
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {q.weight} · {q.half_life_days}d
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------- score preview */

/**
 * Mirrors the firmographic half of src/scoring/score.ts: an excluded industry
 * zeroes fit outright, each configured dimension is scored 0..1, and unknown
 * company data scores a neutral 0.5 rather than failing.
 */
function fitFor(lead: Lead, draft: Draft): number {
  const industry = (lead.industry ?? "").toLowerCase();
  const country = (lead.country ?? "").toLowerCase();

  if (draft.exclude_industries.some((x) => x && industry.includes(x.toLowerCase()))) return 0;

  const parts: number[] = [];

  if (draft.countries.length) {
    parts.push(!country ? 0.5 : draft.countries.some((c) => c.toLowerCase() === country) ? 1 : 0);
  }
  if (draft.industries.length) {
    parts.push(
      !industry
        ? 0.5
        : draft.industries.some((i) => industry.includes(i.toLowerCase()) || i.toLowerCase().includes(industry))
          ? 1
          : 0,
    );
  }
  const min = draft.min_employees === "" ? null : num(draft.min_employees);
  const max = draft.max_employees === "" ? null : num(draft.max_employees);
  if (min !== null || max !== null) {
    const n = lead.employee_count;
    parts.push(n == null ? 0.5 : (min === null || n >= min) && (max === null || n <= max) ? 1 : 0);
  }

  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;
}

function ScorePreview({ draft, leads, loading }: { draft: Draft; leads: Lead[]; loading: boolean }) {
  const preview = useMemo(() => {
    if (!leads.length) return null;

    const rescored = leads.map((l) => {
      // fitFor returns 0..1; intent_score is already stored 0..100.
      const fit = fitFor(l, draft);
      const total = Math.min(
        100,
        Math.max(0, draft.fit_weight * fit * 100 + (1 - draft.fit_weight) * l.intent_score - l.penalty),
      );
      return { lead: l, fit, total: l.disqualified ? 0 : total };
    });

    const live = rescored.filter((r) => !r.lead.disqualified);
    const avgNow = live.reduce((n, r) => n + r.lead.total, 0) / Math.max(1, live.length);
    const avgNext = live.reduce((n, r) => n + r.total, 0) / Math.max(1, live.length);

    return {
      avgNow,
      avgNext,
      hotNow: live.filter((r) => r.lead.total >= 70).length,
      hotNext: live.filter((r) => r.total >= 70).length,
      excluded: rescored.filter((r) => r.fit === 0).length,
      avgFit: live.reduce((n, r) => n + r.fit, 0) / Math.max(1, live.length),
      top: [...rescored].sort((a, b) => b.total - a.total).slice(0, 5),
      n: live.length,
    };
  }, [leads, draft]);

  return (
    <Card className="gap-6 p-6 xl:sticky xl:top-[116px]">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Score preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          What the draft profile would do to the {fmtInt(preview?.n ?? 0)} scored leads, computed in the browser.
          Nothing is written until you save and re-score.
        </p>
      </CardHeader>

      <CardContent className="gap-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        ) : !preview ? (
          <p className="text-sm text-muted-foreground">
            No scored leads yet, so there is nothing to preview against.
          </p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3">
              <ScoreRing value={preview.avgNext} size={160} thickness={14} caption="avg. score" />
              <p className="text-sm text-muted-foreground">
                now {fmtScore(preview.avgNow)} →{" "}
                <span
                  className={cn(
                    "font-medium",
                    preview.avgNext > preview.avgNow ? "text-[oklch(0.45_0.13_155)]" : "text-foreground",
                  )}
                >
                  {fmtScore(preview.avgNext)}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Stat label="Hot leads" now={preview.hotNow} next={preview.hotNext} />
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span>Average fit</span>
                  <span className="font-medium tabular-nums">{(preview.avgFit * 100).toFixed(0)}</span>
                </div>
                <Meter value={preview.avgFit} label="Average fit" />
              </div>
              {preview.excluded > 0 && (
                <p className="flex items-start gap-2 text-xs leading-5 text-destructive">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {preview.excluded} compan{preview.excluded === 1 ? "y" : "ies"} would score zero fit from an excluded
                  industry.
                </p>
              )}
            </div>

            <div className="border-t border-border pt-5">
              <FieldLabel>Top leads under this profile</FieldLabel>
              <div className="mt-3 flex flex-col gap-2.5">
                {preview.top.map((r) => (
                  <div key={r.lead.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to={`/leads/${r.lead.id}`} className="truncate hover:underline">
                      {r.lead.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmtScore(r.lead.total)} → <span className="font-medium text-foreground">{fmtScore(r.total)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, now, next }: { label: string; now: number; next: number }) {
  const delta = next - now;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-muted-foreground">{now}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-semibold">{next}</span>
        {delta !== 0 && (
          <span className={cn("text-xs", delta > 0 ? "text-[oklch(0.45_0.13_155)]" : "text-destructive")}>
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

