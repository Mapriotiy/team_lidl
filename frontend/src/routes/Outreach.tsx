/**
 * Outreach — Screen 7.
 *
 * The comp showed open and reply rates. Nothing in this platform sends mail,
 * so reporting those would be fiction. A sequence here is a saved audience rule
 * plus an ordered set of steps; the columns report what is actually known —
 * how many companies the rule matches, how many are enrolled, and how many
 * have an evidence-backed draft written.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { api, BANDS } from "@/api";
import type { Band, Sequence, SequenceStep } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { useServiceGate } from "@/components/ServiceGate";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, EmptyState, Banner } from "@/components/states";
import { BandChip } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, Label, Skeleton, Tooltip } from "@/components/ui/misc";
import { fmtDateTime, fmtInt, fmtRelative, fmtScore } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHANNELS = ["email", "linkedin", "call", "task"] as const;

export function Outreach() {
  const gate = useServiceGate();
  const { serviceKey, service } = useWorkspace();
  const [tab, setTab] = useState("sequences");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const sequences = useAsync(() => api.sequences(serviceKey), [serviceKey], Boolean(serviceKey));
  const activity = useAsync(() => api.outreachActivity(serviceKey, 30), [serviceKey], Boolean(serviceKey));

  const rows = sequences.data ?? [];
  const selected = rows.find((s) => s.id === selectedId) ?? rows[0] ?? null;

  const upsert = (seq: Sequence) =>
    sequences.setData((prev) => {
      const list = prev ?? [];
      return list.some((s) => s.id === seq.id) ? list.map((s) => (s.id === seq.id ? seq : s)) : [seq, ...list];
    });

  const toggleStatus = async (seq: Sequence) => {
    const next = seq.status === "active" ? "paused" : "active";
    try {
      upsert(await api.updateSequence(seq.id, { status: next }));
      setNotice({ tone: "ok", text: `"${seq.name}" is now ${next}.` });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = async (seq: Sequence) => {
    if (!window.confirm(`Delete "${seq.name}"? Its enrolments go with it. Drafts already written are kept.`)) return;
    const before = rows;
    sequences.setData((prev) => (prev ?? []).filter((s) => s.id !== seq.id));
    try {
      await api.deleteSequence(seq.id);
      if (selectedId === seq.id) setSelectedId(null);
    } catch (e) {
      sequences.setData(before);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const enroll = async (seq: Sequence) => {
    try {
      const res = await api.enrollSequence(seq.id);
      upsert(res.sequence);
      setNotice({
        tone: "ok",
        text: res.enrolled === 0
          ? `No company currently matches "${seq.name}". Lower the minimum score or re-score first.`
          : `Enrolled ${res.enrolled} compan${res.enrolled === 1 ? "y" : "ies"} into "${seq.name}".`,
      });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  if (gate) return <>{gate}</>;

  return (
    <>
      <PageHeader
        title="Outreach"
        description={`Turn confirmed intent into first touches for ${service?.name ?? "this service"}. Drafts are written from verified evidence only — nothing is sent from here.`}
        actions={
          <>
            <Button variant="outline" onClick={() => { sequences.reload(); activity.reload(); }} disabled={sequences.loading}>
              <RefreshCw className={cn("size-4", sequences.loading && "animate-spin")} />
              Refresh
            </Button>
            <SequenceDialog serviceKey={serviceKey} onSaved={(s) => { upsert(s); setSelectedId(s.id); }} />
          </>
        }
      />

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="activity">
            Drafts written
            {activity.data?.length ? <span className="tabular-nums opacity-70">{activity.data.length}</span> : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "activity" ? (
        <ActivityTab activity={activity} />
      ) : sequences.error ? (
        <ErrorState error={sequences.error} what="sequences" onRetry={sequences.reload} />
      ) : sequences.loading && sequences.firstLoad ? (
        <Loading label="Loading sequences" rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No sequences yet"
          body="A sequence is a saved audience rule — say, every lead scoring 70 or more — plus the touches you plan to make. Create one to work a band of leads consistently instead of one at a time."
          action={<SequenceDialog serviceKey={serviceKey} onSaved={(s) => { upsert(s); setSelectedId(s.id); }} />}
        />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <SequenceTable
            rows={rows}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onToggle={toggleStatus}
            onDelete={remove}
          />
          {selected && <SequenceDetail sequence={selected} onEnroll={enroll} onSaved={upsert} />}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- table */

function SequenceTable({
  rows,
  selectedId,
  onSelect,
  onToggle,
  onDelete,
}: {
  rows: Sequence[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (s: Sequence) => void;
  onDelete: (s: Sequence) => void;
}) {
  return (
    <Card className="gap-4 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Sequences</CardTitle>
        <p className="text-sm text-muted-foreground">
          Audience is live — it re-counts against the latest scores. Enrolled is what you have pulled in so far.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Outreach sequences</caption>
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-3 pr-4">Sequence</th>
                <th scope="col" className="py-3 pr-4">Audience rule</th>
                <th scope="col" className="py-3 pr-4 text-right">Matches</th>
                <th scope="col" className="py-3 pr-4 text-right">Enrolled</th>
                <th scope="col" className="py-3 pr-4 text-right">Drafted</th>
                <th scope="col" className="py-3 pr-4">Status</th>
                <th scope="col" className="w-20 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "cursor-pointer border-b border-border last:border-0 hover:bg-accent/40",
                    selectedId === s.id && "bg-accent/50",
                  )}
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      {s.status === "active" ? (
                        <Play className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Pause className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        {s.description && (
                          <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    Score ≥ {fmtScore(s.min_score)}
                    {s.band ? `, ${s.band} only` : ""}
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums">{fmtInt(s.audience)}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{fmtInt(s.enrolled)}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{fmtInt(s.drafted)}</td>
                  <td className="py-4 pr-4">
                    <Badge variant={s.status === "active" ? "positive" : "muted"}>{s.status}</Badge>
                  </td>
                  <td className="py-4">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip label={s.status === "active" ? "Pause" : "Activate"}>
                        <Button variant="ghost" size="icon-sm" onClick={() => onToggle(s)} aria-label={`${s.status === "active" ? "Pause" : "Activate"} ${s.name}`}>
                          {s.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
                        </Button>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(s)}
                          aria-label={`Delete ${s.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- detail */

function SequenceDetail({
  sequence: s,
  onEnroll,
  onSaved,
}: {
  sequence: Sequence;
  onEnroll: (s: Sequence) => void;
  onSaved: (s: Sequence) => void;
}) {
  const audience = useAsync(() => api.sequenceAudience(s.id), [s.id, s.enrolled, s.min_score, s.band]);
  const rows = audience.data ?? [];
  const pending = rows.filter((r) => !r.enrolled);

  return (
    <Card className="h-fit gap-6 p-6 xl:sticky xl:top-[116px]">
      <CardHeader className="gap-1.5 border-b border-border pb-5">
        <CardTitle className="text-lg">{s.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {s.description || `Every ${s.band ?? "non-disqualified"} lead scoring ${fmtScore(s.min_score)} or above.`}
        </p>
      </CardHeader>

      <CardContent className="gap-6">
        <div>
          <FieldLabel>Audience</FieldLabel>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-3.5 py-3 text-sm">
            <span>
              Score ≥ {fmtScore(s.min_score)}
              {s.band ? `, ${s.band}` : ""}
            </span>
            <span className="text-muted-foreground tabular-nums">{fmtInt(s.audience)} match</span>
          </div>
          {pending.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pending.length} matching compan{pending.length === 1 ? "y is" : "ies are"} not enrolled yet.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Step timeline</FieldLabel>
          <div className="mt-3 flex flex-col">
            {s.steps.map((step, i) => (
              <div key={`${step.day}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {i + 1}
                  </span>
                  {i < s.steps.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn("min-w-0", i < s.steps.length - 1 && "pb-5")}>
                  <p className="text-sm font-medium">
                    Day {step.day} · {step.channel}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Enrolled companies</FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums">{fmtInt(s.enrolled)}</span>
          </div>
          <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {audience.loading && audience.firstLoad ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No company matches this rule yet.
              </p>
            ) : (
              rows.slice(0, 40).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/leads/${r.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {r.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.drafts > 0 && (
                      <Tooltip label={`${r.drafts} draft${r.drafts === 1 ? "" : "s"} written`}>
                        <span>
                          <Badge variant="muted">{r.drafts}</Badge>
                        </span>
                      </Tooltip>
                    )}
                    <BandChip band={r.band} />
                    <span className="w-9 text-right tabular-nums text-muted-foreground">{fmtScore(r.total)}</span>
                    {r.enrolled ? (
                      <Tooltip label={`Enrolled ${fmtRelative(r.enrolled_at)}`}>
                        <span className="size-2 rounded-full bg-primary" />
                      </Tooltip>
                    ) : (
                      <span className="size-2 rounded-full border border-border" />
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border pt-5">
          <Button onClick={() => onEnroll(s)} disabled={s.audience === 0}>
            <UserPlus className="size-4" />
            {pending.length > 0 ? `Enrol ${pending.length} new` : "Re-check enrolments"}
          </Button>
          <SequenceDialog
            serviceKey={s.service_key}
            existing={s}
            onSaved={onSaved}
            trigger={
              <Button variant="outline" className="w-full">
                Edit sequence
              </Button>
            }
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Enrolling records who you intend to contact. Open a lead to generate the evidence-backed draft itself.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- activity */

function ActivityTab({
  activity,
}: {
  activity: ReturnType<typeof useAsync<Awaited<ReturnType<typeof api.outreachActivity>>>>;
}) {
  if (activity.error) return <ErrorState error={activity.error} what="draft activity" onRetry={activity.reload} />;
  if (activity.loading && activity.firstLoad) return <Loading label="Loading drafts" rows={4} />;
  if (!activity.data?.length) {
    return (
      <EmptyState
        icon={Mail}
        title="No drafts written yet"
        body="Open a lead and use Draft outreach. Every draft is written from that company's verified evidence and stored here."
      />
    );
  }

  return (
    <Card className="gap-4 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Drafts written</CardTitle>
        <p className="text-sm text-muted-foreground">Newest first. Expand one to read what the model produced.</p>
      </CardHeader>
      <CardContent className="gap-3">
        {activity.data.map((d) => (
          <details key={d.id} className="rounded-xl border border-border p-4">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <Link
                  to={`/leads/${d.company_id}`}
                  className="font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {d.company_name}
                </Link>
                {d.band && <BandChip band={d.band} />}
                <Badge variant="outline">{d.channel}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(d.created_at)}</span>
            </summary>
            <div className="mt-4 border-t border-border pt-4">
              {d.subject && <p className="font-semibold">{d.subject}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{d.body}</p>
              <Link
                to={`/leads/${d.company_id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                Open the evidence trail
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------- create / edit */

const DEFAULT_STEPS: SequenceStep[] = [
  { day: 1, channel: "email", label: "First touch referencing the confirmed signal" },
  { day: 4, channel: "linkedin", label: "Connection request" },
  { day: 9, channel: "email", label: "Follow-up with a second piece of evidence" },
];

function SequenceDialog({
  serviceKey,
  existing,
  onSaved,
  trigger,
}: {
  serviceKey: string;
  existing?: Sequence;
  onSaved: (s: Sequence) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [minScore, setMinScore] = useState(String(existing?.min_score ?? 70));
  const [band, setBand] = useState<string>(existing?.band ?? "any");
  const [steps, setSteps] = useState<SequenceStep[]>(existing?.steps?.length ? existing.steps : DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && steps.length > 0;

  const reset = () => {
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setMinScore(String(existing?.min_score ?? 70));
    setBand(existing?.band ?? "any");
    setSteps(existing?.steps?.length ? existing.steps : DEFAULT_STEPS);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      description: description.trim(),
      min_score: Math.max(0, Math.min(100, Number(minScore) || 0)),
      band: (band === "any" ? null : band) as Band | null,
      steps,
    };
    try {
      const saved = existing
        ? await api.updateSequence(existing.id, body)
        : await api.createSequence({ service: serviceKey, ...body });
      onSaved(saved);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const setStep = (i: number, patch: Partial<SequenceStep>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            New sequence
          </Button>
        )}
      </span>

      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{existing ? "Edit sequence" : "New sequence"}</DialogTitle>
            <DialogDescription>
              The audience is a rule, not a fixed list — it re-evaluates against the latest scores every time you
              enrol.
            </DialogDescription>
          </DialogHeader>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="seq-name">Name</Label>
            <Input
              id="seq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High intent — hiring signal"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seq-desc">Description</Label>
            <Input
              id="seq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Worked weekly by the AE team"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="seq-score">Minimum score</Label>
              <Input
                id="seq-score"
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Band</Label>
              <Select value={band} onValueChange={setBand}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any band</SelectItem>
                  {BANDS.filter((b) => b !== "disqualified").map((b) => (
                    <SelectItem key={b} value={b}>
                      {b} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel>Steps</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSteps((p) => [
                    ...p,
                    { day: (p[p.length - 1]?.day ?? 0) + 3, channel: "email", label: "Follow-up" },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add step
              </Button>
            </div>

            {steps.map((step, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={step.day}
                  onChange={(e) => setStep(i, { day: Number(e.target.value) || 1 })}
                  className="h-9 w-20"
                  aria-label={`Day for step ${i + 1}`}
                />
                <Select value={step.channel} onValueChange={(v) => setStep(i, { channel: v })}>
                  <SelectTrigger className="h-9 w-[128px]" aria-label={`Channel for step ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={step.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                  className="h-9 min-w-[200px] flex-1"
                  aria-label={`Label for step ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSteps((p) => p.filter((_, j) => j !== i))}
                  disabled={steps.length === 1}
                  aria-label={`Remove step ${i + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Saving…" : existing ? "Save changes" : "Create sequence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
