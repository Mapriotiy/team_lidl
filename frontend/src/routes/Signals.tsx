/**
 * Signals — Screen 4.
 *
 * Two jobs in one screen, as the comp had it: the live feed of what fired, and
 * the configuration behind it. The comp's category tabs (Hiring / Funding /
 * Technology) do not exist in this data model — questions are grouped by the
 * source kind they read — so the tabs filter by that instead of by an invented
 * taxonomy.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, num, POLARITIES, SOURCE_KINDS, WEIGHTS } from "@/api";
import type { Polarity, SignalQuestion, SourceKind, Weight } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, EmptyState, Banner } from "@/components/states";
import { BandChip, PolarityChip } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, Label, Meter, Skeleton, Tooltip } from "@/components/ui/misc";
import { fmtInt, fmtRelative, fmtScore, hostOf } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Signals() {
  const gate = useServiceGate();
  const { serviceKey, service } = useWorkspace();
  const [kind, setKind] = useState<SourceKind | "all">("all");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const feed = useAsync(
    () => api.recentSignals({ service: serviceKey, kind: kind === "all" ? "" : kind, limit: 40 }),
    [serviceKey, kind],
    Boolean(serviceKey),
  );
  const volume = useAsync(() => api.signalVolume(serviceKey), [serviceKey], Boolean(serviceKey));
  const questions = useAsync(() => api.questions(serviceKey), [serviceKey], Boolean(serviceKey));

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Signals"
        description={`Live buying intent for ${service?.name ?? "this service"}, and the questions that produce it. Every signal keeps the quote it was confirmed from.`}
        actions={
          <>
            <Button variant="outline" onClick={() => { feed.reload(); volume.reload(); }} disabled={feed.loading}>
              <RefreshCw className={cn("size-4", feed.loading && "animate-spin")} />
              Refresh
            </Button>
            <AddQuestionDialog
              serviceKey={serviceKey}
              onAdded={(q) => {
                questions.setData((prev) => [...(prev ?? []).filter((r) => r.id !== q.id), q]);
                volume.reload();
                setNotice({ tone: "ok", text: `Added "${q.key}". It fires on existing companies only after the next evaluate run.` });
              }}
            />
          </>
        }
      />

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      <Tabs value={kind} onValueChange={(v) => setKind(v as SourceKind | "all")}>
        <TabsList>
          <TabsTrigger value="all">All sources</TabsTrigger>
          {SOURCE_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SignalFeed feed={feed} kind={kind} />
        <SignalVolumeCard volume={volume} />
      </div>

      <QuestionTable
        questions={questions}
        serviceKey={serviceKey}
        onNotice={setNotice}
        onChanged={() => volume.reload()}
      />
    </>
  );
}

/* ------------------------------------------------------------------- feed */

function SignalFeed({
  feed,
  kind,
}: {
  feed: ReturnType<typeof useAsync<Awaited<ReturnType<typeof api.recentSignals>>>>;
  kind: string;
}) {
  return (
    <Card className="gap-5 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Recent activity</CardTitle>
        <p className="text-sm text-muted-foreground">
          Confirmed signals, newest first{kind === "all" ? "" : ` — ${kind} sources only`}.
        </p>
      </CardHeader>
      <CardContent>
        {feed.error ? (
          <p className="text-sm text-destructive">{feed.error}</p>
        ) : feed.loading && feed.firstLoad ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !feed.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No signal has been confirmed{kind === "all" ? "" : ` from ${kind} sources`} yet. Run the evaluate step to
            answer the signal questions against stored evidence.
          </p>
        ) : (
          feed.data.map((s) => {
            const top = s.evidence[0];
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-4 border-b border-border py-5 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <Tooltip label={s.band ? `${s.company_name} scores ${fmtScore(s.company_score ?? 0)}` : "Not scored"}>
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums",
                        s.band === "hot" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {s.company_score === null ? "—" : fmtScore(s.company_score)}
                    </span>
                  </Tooltip>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link to={`/leads/${s.company_id}`} className="text-sm font-semibold hover:underline">
                        {s.company_name}
                      </Link>
                      {s.band && <BandChip band={s.band} />}
                      <PolarityChip polarity={s.polarity} />
                    </span>
                    <p className="text-sm">{s.question}</p>
                    {top?.quote && (
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">“{top.quote}”</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {fmtRelative(s.evaluated_at)}
                      <span className="px-1">·</span>
                      {(s.confidence * 100).toFixed(0)}% confidence
                      {top?.url && (
                        <>
                          <span className="px-1">·</span>
                          {hostOf(top.url)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {top?.url && (
                  <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                    <a href={top.url} target="_blank" rel="noreferrer noopener">
                      View evidence
                      <ArrowUpRight className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------- volume */

function SignalVolumeCard({ volume }: { volume: ReturnType<typeof useAsync<Awaited<ReturnType<typeof api.signalVolume>>>> }) {
  const rows = (volume.data ?? []).filter((v) => v.evaluated > 0).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.confirmed));

  return (
    <Card className="h-fit gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">How often each question fires</CardTitle>
        <p className="text-sm text-muted-foreground">Confirmed answers per question, across every evaluated company.</p>
      </CardHeader>
      <CardContent className="gap-5">
        {volume.error ? (
          <p className="text-sm text-destructive">{volume.error}</p>
        ) : volume.loading && volume.firstLoad ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No question has been evaluated yet, so there is nothing to count.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <Tooltip label={r.text}>
                  <span className="truncate text-sm">{r.key.replace(/_/g, " ")}</span>
                </Tooltip>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {fmtInt(r.confirmed)}
                  <span className="text-muted-foreground"> / {fmtInt(r.evaluated)}</span>
                </span>
              </div>
              <Meter value={r.confirmed / max} label={r.key} className="h-3" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- questions */

function QuestionTable({
  questions,
  serviceKey,
  onNotice,
  onChanged,
}: {
  questions: ReturnType<typeof useAsync<SignalQuestion[]>>;
  serviceKey: string;
  onNotice: (n: { tone: "ok" | "error"; text: string } | null) => void;
  onChanged: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const rows = questions.data ?? [];

  const patch = async (id: string, body: Partial<SignalQuestion>) => {
    const before = rows;
    questions.setData((prev) => (prev ?? []).map((q) => (q.id === id ? { ...q, ...body } : q)));
    try {
      const saved = await api.updateQuestion(id, body);
      questions.setData((prev) => (prev ?? []).map((q) => (q.id === id ? saved : q)));
      setDirty(true);
      onNotice(null);
    } catch (e) {
      questions.setData(before); // roll the optimistic edit back
      onNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = async (q: SignalQuestion) => {
    if (!window.confirm(`Delete the signal "${q.key}"? Scores will stop considering it.`)) return;
    const before = rows;
    questions.setData((prev) => (prev ?? []).filter((r) => r.id !== q.id));
    try {
      await api.deleteQuestion(q.id);
      setDirty(true);
      onChanged();
    } catch (e) {
      questions.setData(before);
      onNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const rescore = async () => {
    setRescoring(true);
    try {
      const res = await api.rescore(serviceKey);
      onNotice({ tone: "ok", text: `Re-scored ${num(res?.rescored)} companies against the current questions.` });
      setDirty(false);
      onChanged();
    } catch (e) {
      onNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setRescoring(false);
    }
  };

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">Signal questions</CardTitle>
          <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
            The questions asked of every scraped document. Change a weight or half-life and re-score — no code, no
            redeploy. Re-scoring replays the saved answers, so it never calls the model.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-sm text-destructive">Scores are stale</span>}
          <Button onClick={rescore} disabled={rescoring || !serviceKey}>
            {rescoring ? "Re-scoring…" : "Re-score all"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {questions.error ? (
          <ErrorState error={questions.error} what="signal questions" onRetry={questions.reload} />
        ) : questions.loading && questions.firstLoad ? (
          <Loading label="Loading questions" rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No questions configured for this service"
            body="Nothing can be scored until at least one question exists. A positive signal is the usual starting point."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Signal questions, editable in place</caption>
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th scope="col" className="w-16 py-3">On</th>
                  <th scope="col" className="py-3 pr-4">Question</th>
                  <th scope="col" className="w-[130px] py-3 pr-4">Polarity</th>
                  <th scope="col" className="w-[120px] py-3 pr-4">Weight</th>
                  <th scope="col" className="w-[110px] py-3 pr-4 text-right">Half-life</th>
                  <th scope="col" className="w-[240px] py-3 pr-4">Sources</th>
                  <th scope="col" className="w-12 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <QuestionRow key={q.id} q={q} onPatch={patch} onDelete={remove} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionRow({
  q,
  onPatch,
  onDelete,
}: {
  q: SignalQuestion;
  onPatch: (id: string, patch: Partial<SignalQuestion>) => void;
  onDelete: (q: SignalQuestion) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [halfLife, setHalfLife] = useState(String(q.half_life_days));

  const commitHalfLife = () => {
    const v = Math.max(1, Math.round(num(halfLife, q.half_life_days)));
    setHalfLife(String(v));
    if (v !== q.half_life_days) onPatch(q.id, { half_life_days: v });
  };

  return (
    <tr className={cn("border-b border-border last:border-0 align-top", !q.enabled && "opacity-55")}>
      <td className="py-4">
        <Tooltip label={q.enabled ? "Enabled — counted in scoring" : "Disabled — ignored by scoring"}>
          <span className="inline-block">
            <Switch checked={q.enabled} onCheckedChange={(v) => onPatch(q.id, { enabled: v })} aria-label={`Enable ${q.key}`} />
          </span>
        </Tooltip>
      </td>

      <td className="max-w-[420px] py-4 pr-4">
        <p className="font-mono text-xs text-muted-foreground">{q.key}</p>
        {editing ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const t = text.trim();
                  if (t && t !== q.text) onPatch(q.id, { text: t });
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(q.text);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-1 text-left text-sm leading-6 hover:underline"
            onClick={() => setEditing(true)}
            title="Click to edit the question"
          >
            {q.text}
          </button>
        )}
      </td>

      <td className="py-4 pr-4">
        <Select value={q.polarity} onValueChange={(v) => onPatch(q.id, { polarity: v as Polarity })}>
          <SelectTrigger className="h-9" aria-label={`Polarity for ${q.key}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POLARITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="py-4 pr-4">
        <Tooltip label={q.polarity === "disqualifier" ? "Disqualifiers zero the score outright — weight is unused" : ""}>
          <span className="inline-block w-full">
            <Select
              value={q.weight}
              onValueChange={(v) => onPatch(q.id, { weight: v as Weight })}
              disabled={q.polarity === "disqualifier"}
            >
              <SelectTrigger className="h-9" aria-label={`Weight for ${q.key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEIGHTS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </Tooltip>
      </td>

      <td className="py-4 pr-4 text-right">
        <Input
          type="number"
          min={1}
          value={halfLife}
          onChange={(e) => setHalfLife(e.target.value)}
          onBlur={commitHalfLife}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-9 text-right"
          aria-label={`Half-life in days for ${q.key}`}
        />
        <p className="mt-1 text-xs text-muted-foreground">days</p>
      </td>

      <td className="py-4 pr-4">
        <SourceKindPicker
          selected={q.source_kinds}
          onChange={(kinds) => onPatch(q.id, { source_kinds: kinds })}
          name={q.key}
        />
      </td>

      <td className="py-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(q)}
          aria-label={`Delete ${q.key}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
}

function SourceKindPicker({
  selected,
  onChange,
  name,
}: {
  selected: SourceKind[];
  onChange: (kinds: SourceKind[]) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SOURCE_KINDS.map((k) => {
        const on = selected.includes(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            title={`${on ? "Stop reading" : "Read"} ${k} documents for ${name}`}
            onClick={() => onChange(on ? selected.filter((s) => s !== k) : [...selected, k])}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              on ? "bg-secondary text-secondary-foreground" : "border border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ add question */

function AddQuestionDialog({ serviceKey, onAdded }: { serviceKey: string; onAdded: (q: SignalQuestion) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [weight, setWeight] = useState<Weight>("medium");
  const [polarity, setPolarity] = useState<Polarity>("positive");
  const [halfLife, setHalfLife] = useState("180");
  const [kinds, setKinds] = useState<SourceKind[]>(["website", "jobs", "news"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive a sane key from the question so the operator rarely types one.
  const suggestedKey = useMemo(
    () =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter((w) => !["is", "the", "a", "an", "are", "does", "do", "of", "for", "to"].includes(w))
        .slice(0, 4)
        .join("_"),
    [text],
  );

  const effectiveKey = key.trim() || suggestedKey;
  const valid = effectiveKey.length > 0 && text.trim().length > 0 && kinds.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createQuestion(serviceKey, {
        key: effectiveKey,
        text: text.trim(),
        weight,
        polarity,
        source_kinds: kinds,
        half_life_days: Math.max(1, Math.round(num(halfLife, 180))),
      });
      onAdded(created);
      setKey("");
      setText("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const polarityHelp = {
    positive: "Adds intent when confirmed.",
    negative: "Subtracts a penalty when confirmed. Penalties never decay.",
    disqualifier: "Zeroes the lead outright when confirmed at 50% confidence or more.",
  }[polarity];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>
        <Button>
          <Plus className="size-4" />
          Add question
        </Button>
      </span>

      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>New signal question</DialogTitle>
            <DialogDescription>
              Write it as a yes/no question a colleague could answer from a web page. Reusing an existing key updates
              that question instead of adding a duplicate.
            </DialogDescription>
          </DialogHeader>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="q-text">Question</Label>
            <Textarea
              id="q-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Is the company hiring backend or platform engineers right now?"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-key">Key</Label>
              <Input
                id="q-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={suggestedKey || "hiring_backend_engineers"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {key.trim() ? "Shown on charts and in the evidence trail." : `Leave blank to use "${suggestedKey || "…"}".`}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="q-half">Half-life (days)</Label>
              <Input
                id="q-half"
                type="number"
                min={1}
                value={halfLife}
                onChange={(e) => setHalfLife(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">How fast this signal goes stale. 120 for hiring, 365 for strategy.</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Polarity</Label>
              <Select value={polarity} onValueChange={(v) => setPolarity(v as Polarity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLARITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{polarityHelp}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Weight</Label>
              <Select
                value={weight}
                onValueChange={(v) => setWeight(v as Weight)}
                disabled={polarity === "disqualifier"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEIGHTS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">high = 3 points, medium = 2, low = 1.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>Which sources to read</FieldLabel>
            <SourceKindPicker selected={kinds} onChange={setKinds} name="the new question" />
            {kinds.length === 0 && <p className="text-xs text-destructive">Pick at least one source.</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Saving…" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

