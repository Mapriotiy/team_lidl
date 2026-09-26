/**
 * Settings — Screen 9.
 *
 * The comp had a Billing card. There is no billing: this is software someone
 * runs themselves. That panel is replaced by the thing an operator of this
 * platform actually needs to see — how the backend is configured, and whether
 * the keys it depends on are present. Secrets are reported as set or unset and
 * never echoed.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, EyeOff, Plug, Plus, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { api, API_URL, DEFAULT_NOTIFICATIONS, LLM_PRESETS } from "@/api";
import type { Member, MemberRole, NotificationPrefs } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { PageHeader } from "@/components/PageHeader";
import { Loading, ErrorState, Banner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Avatar, AvatarFallback, Label, Tooltip } from "@/components/ui/misc";
import { fmtInt, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NOTIFICATION_COPY: Record<keyof NotificationPrefs, { label: string; hint: string }> = {
  hot_lead: { label: "A lead reaches the hot band", hint: "Score crosses 70 on a re-score." },
  weekly_digest: { label: "Weekly pipeline digest", hint: "Summary of new evidence and confirmed signals." },
  crawl_failures: { label: "Crawl failures", hint: "A source stops returning documents." },
  product_updates: { label: "Product updates", hint: "Changes to the platform itself." },
};

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "model", label: "Model" },
  { id: "team", label: "Team" },
  { id: "notifications", label: "Notifications" },
  { id: "runtime", label: "Backend" },
] as const;

export function Settings() {
  const { settingsState, appearance, setAppearance } = useWorkspace();
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("general");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace preferences and how this dashboard is wired to the backend."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[192px_minmax(0,1fr)]">
        <Tabs
          value={section}
          onValueChange={(v) => setSection(v as typeof section)}
          orientation="vertical"
          className="lg:sticky lg:top-[116px]"
        >
          <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="justify-start rounded-xl px-4 py-3">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex max-w-3xl flex-col gap-4">
          {settingsState.error ? (
            <ErrorState error={settingsState.error} what="workspace settings" onRetry={settingsState.reload} />
          ) : settingsState.loading && settingsState.firstLoad ? (
            <Loading label="Loading settings" rows={3} />
          ) : (
            <>
              {section === "general" && <GeneralCard appearance={appearance} setAppearance={setAppearance} />}
              {section === "model" && <ModelCard />}
              {section === "team" && <TeamCard />}
              {section === "notifications" && <NotificationsCard />}
              {section === "runtime" && <RuntimeCard />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- general */

function GeneralCard({
  appearance,
  setAppearance,
}: {
  appearance: "light" | "dark";
  setAppearance: (v: "light" | "dark") => void;
}) {
  const { settings, settingsState } = useWorkspace();
  const [name, setName] = useState(settings.name);
  const [slug, setSlug] = useState(settings.slug);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    setName(settings.name);
    setSlug(settings.slug);
    setTimezone(settings.timezone);
  }, [settings.name, settings.slug, settings.timezone]);

  const dirty = name !== settings.name || slug !== settings.slug || timezone !== settings.timezone;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.saveSettings({
        name: name.trim(),
        slug,
        timezone,
        notifications: settings.notifications,
      });
      settingsState.reload();
      setNotice({ tone: "ok", text: "Workspace saved." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Intl.supportedValuesOf is ES2023 and not in this project's lib, so it is
  // probed at runtime; older browsers fall back to a short sensible list.
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const zones: string[] = supportedValuesOf
    ? supportedValuesOf("timeZone")
    : [...new Set([timezone, "UTC", "Europe/Chisinau", "Europe/London", "America/New_York"])];

  return (
    <>
      <Card className="gap-6 p-6">
        <form onSubmit={save} className="flex flex-col gap-6">
          <CardHeader className="gap-1.5">
            <CardTitle className="text-lg">Workspace</CardTitle>
            <p className="text-sm text-muted-foreground">
              The name shown in the sidebar and used for the avatar initials.
            </p>
          </CardHeader>

          {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

          <CardContent className="gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ws-slug">Workspace slug</Label>
              <Input
                id="ws-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lower case, letters, digits and hyphens. Anything else is rewritten on save.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dates in the dashboard render in your browser's locale; this is what a scheduled report would use.
              </p>
            </div>
          </CardContent>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving || !dirty || !name.trim()}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="gap-5 p-6">
        <CardHeader className="gap-1.5">
          <CardTitle className="text-lg">Appearance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Both palettes come from the same design tokens, so nothing shifts but the colours.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">Dark appearance</span>
            <Switch
              checked={appearance === "dark"}
              onCheckedChange={(v) => setAppearance(v ? "dark" : "light")}
              aria-label="Dark appearance"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ model */

/**
 * Connect a model. Anything speaking the OpenAI chat-completions schema works,
 * so this is a base URL, a model string and a key rather than a fixed provider
 * list — the presets are shortcuts, not the only options.
 *
 * The key is write-only: the server returns a hint like "sk-…4f2a" and never
 * the value, so an existing key can be kept without the browser ever holding
 * it. Leaving the field blank on save means "keep the one already stored".
 */
/** `{"X-Title": "Orange Signal"}` <-> one `X-Title: Orange Signal` per line. */
const formatHeaders = (headers: Record<string, string>): string =>
  Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Split on the first colon only - values contain them (https://…).
    const at = trimmed.indexOf(":");
    if (at <= 0) continue;
    const name = trimmed.slice(0, at).trim();
    const value = trimmed.slice(at + 1).trim();
    if (name && value) out[name] = value;
  }
  return out;
}

function ModelCard() {
  const llm = useAsync(() => api.llm(), []);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (llm.data) {
      setBaseUrl(llm.data.base_url);
      setModel(llm.data.model);
      setHeadersText(formatHeaders(llm.data.extra_headers ?? {}));
    }
  }, [llm.data]);

  const config = llm.data;
  // Compare the parsed headers, not the raw text, so reordering a line or
  // adding a blank one does not light up an unsaved-changes state.
  const headersDirty =
    Boolean(config) &&
    JSON.stringify(parseHeaders(headersText)) !== JSON.stringify(config!.extra_headers ?? {});
  const dirty =
    Boolean(config) &&
    (baseUrl !== config!.base_url || model !== config!.model || apiKey.trim().length > 0 || headersDirty);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !baseUrl.trim() || !model.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await api.saveLlm({
        base_url: baseUrl.trim(),
        model: model.trim(),
        extra_headers: parseHeaders(headersText),
        // Blank means "leave the stored key alone".
        api_key: apiKey.trim() ? apiKey.trim() : undefined,
      });
      llm.setData(saved);
      setApiKey("");
      setNotice({ tone: "ok", text: "Saved. The next evaluate or outreach run uses this model." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const r = await api.testLlm({
        base_url: baseUrl.trim(),
        model: model.trim(),
        api_key: apiKey.trim() || undefined,
        extra_headers: parseHeaders(headersText),
      });
      setNotice({
        tone: "ok",
        text: `${r.model} replied “${r.reply}” in ${fmtInt(r.latency_ms)} ms (${fmtInt(r.usage.input + r.usage.output)} tokens).`,
      });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setNotice(null);
    try {
      const list = await api.llmModels();
      setModels(list);
      if (list.length === 0) {
        setNotice({ tone: "info", text: "The gateway returned no model list. Type the model name instead." });
      }
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoadingModels(false);
    }
  };

  const applyPreset = (label: string) => {
    const preset = LLM_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setBaseUrl(preset.base_url);
    setModel(preset.model);
    setModels(null);
    setNotice({ tone: "info", text: `${preset.note} Add the key for this gateway before saving.` });
  };

  if (llm.error) return <ErrorState error={llm.error} what="the model configuration" onRetry={llm.reload} />;
  if (!config) return <Loading label="Loading the model configuration" rows={3} />;

  return (
    <>
      <Card className="gap-6 p-6">
        <form onSubmit={save} className="flex flex-col gap-6">
          <CardHeader className="gap-1.5">
            <CardTitle className="text-lg">Connected model</CardTitle>
            <p className="max-w-[62ch] text-sm leading-6 text-muted-foreground">
              Any gateway that speaks the OpenAI chat-completions API works — AgentRouter, OpenAI, OpenRouter or a
              local Ollama. Change it here and the next evaluate or outreach run picks it up; no redeploy.
            </p>
          </CardHeader>

          {notice && <Banner tone={notice.tone === "info" ? "info" : notice.tone}>{notice.text}</Banner>}

          <CardContent className="gap-5">
            <div className="flex flex-col gap-2">
              <Label>Preset</Label>
              <div className="flex flex-wrap gap-2">
                {LLM_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    variant={baseUrl === p.base_url ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyPreset(p.label)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Shortcuts that fill the two fields below. Anything else works too — type it in.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="llm-url">Base URL</Label>
              <Input
                id="llm-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://agentrouter.org/v1"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must include the version path. Requests go to{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  {baseUrl.replace(/\/+$/, "") || "…"}/chat/completions
                </code>
                .
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="llm-model">Model</Label>
                <Button type="button" variant="ghost" size="sm" onClick={loadModels} disabled={loadingModels}>
                  <RefreshCw className={cn("size-3.5", loadingModels && "animate-spin")} />
                  {loadingModels ? "Loading…" : "List available"}
                </Button>
              </div>
              <Input
                id="llm-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-opus-5"
                className="font-mono"
                list="llm-model-options"
                required
              />
              {models && models.length > 0 && (
                <datalist id="llm-model-options">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-muted-foreground">
                {models
                  ? `${fmtInt(models.length)} models offered by this gateway — start typing to filter.`
                  : "Whatever this gateway calls the model. “List available” asks it."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="llm-key">API key</Label>
              <div className="flex gap-2">
                <Input
                  id="llm-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config.key_set ? `Stored: ${config.key_hint ?? "••••"} — leave blank to keep` : "sk-…"}
                  className="font-mono"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide the key" : "Show the key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {config.key_set ? (
                  <Badge variant="positive">
                    <Check className="size-3" />
                    key stored ({config.key_source})
                  </Badge>
                ) : (
                  <Badge variant="critical">
                    <X className="size-3" />
                    no key
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Encrypted before it is written to the database, and never sent back to this page.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="llm-headers">Extra request headers</Label>
              <textarea
                id="llm-headers"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={"HTTP-Referer: https://example.com\nX-Title: Orange Signal"}
                className={cn(
                  "min-h-[76px] w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
              />
              <p className="text-xs text-muted-foreground">
                One <code className="rounded bg-muted px-1 py-0.5">Name: value</code> per line, sent with every
                request. Gateways differ in what they want beyond the key — OpenRouter asks for{" "}
                <code className="rounded bg-muted px-1 py-0.5">HTTP-Referer</code> and{" "}
                <code className="rounded bg-muted px-1 py-0.5">X-Title</code>, and some reject requests that do not
                identify the client at all. Leave blank if yours needs nothing.{" "}
                <code className="rounded bg-muted px-1 py-0.5">Authorization</code> and{" "}
                <code className="rounded bg-muted px-1 py-0.5">Content-Type</code> are set by the app and cannot be
                overridden here.
              </p>
            </div>

            {config.key_set && config.key_source === "database" && (
              <button
                type="button"
                className="self-start text-xs text-destructive underline-offset-4 hover:underline"
                onClick={async () => {
                  if (!window.confirm("Remove the stored key? Evaluation and outreach stop until a new one is added.")) return;
                  try {
                    llm.setData(await api.saveLlm({ base_url: baseUrl.trim(), model: model.trim(), api_key: "" }));
                    setNotice({
                      tone: "ok",
                      text: config.env_key_available
                        ? "Stored key removed. The server environment key is used again."
                        : "Stored key removed. Evaluation and outreach will fail until a key is added.",
                    });
                  } catch (err) {
                    setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
                  }
                }}
              >
                Remove the stored key
              </button>
            )}
          </CardContent>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !dirty || !baseUrl.trim() || !model.trim()}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
            <Button type="button" variant="outline" onClick={test} disabled={testing}>
              <Plug className={cn("size-4", testing && "animate-pulse")} />
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <span className="text-xs text-muted-foreground">
              The test is a real one-token round trip against the values above.
            </span>
          </div>
        </form>
      </Card>

      {config.secret_is_managed && (
        <Card className="gap-3 border-[oklch(0.86_0.09_75)] p-6">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[oklch(0.52_0.13_75)]" />
            <div>
              <p className="text-sm font-medium">The encryption secret is server-generated</p>
              <p className="mt-1 max-w-[62ch] text-sm leading-6 text-muted-foreground">
                Your key is encrypted at rest, but the secret that decrypts it is stored in the same database. Set{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">APP_SECRET</code> to a long random value on
                the server and re-enter the key to keep the two apart.
              </p>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------- team */

function TeamCard() {
  const members = useAsync(() => api.members(), []);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const rows = members.data ?? [];

  const setRole = async (m: Member, role: MemberRole) => {
    const before = rows;
    members.setData((prev) => (prev ?? []).map((r) => (r.id === m.id ? { ...r, role } : r)));
    try {
      await api.updateMemberRole(m.id, role);
    } catch (e) {
      members.setData(before);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name} from the workspace?`)) return;
    const before = rows;
    members.setData((prev) => (prev ?? []).filter((r) => r.id !== m.id));
    try {
      await api.removeMember(m.id);
    } catch (e) {
      members.setData(before);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg">Team</CardTitle>
          <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
            Who works this pipeline. Roles are recorded for reference — this deployment has no login, so they do not
            restrict anything yet.
          </p>
        </div>
        <InviteDialog onAdded={(m) => members.setData((prev) => [...(prev ?? []).filter((r) => r.id !== m.id), m])} />
      </CardHeader>

      <CardContent className="gap-4">
        {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

        {members.error ? (
          <p className="text-sm text-destructive">{members.error}</p>
        ) : members.loading && members.firstLoad ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No members recorded yet. Add the people who work these leads so owner names mean something.
          </p>
        ) : (
          rows.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarFallback>{initials(m.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={m.role} onValueChange={(v) => setRole(m, v as MemberRole)}>
                  <SelectTrigger className="h-9 w-[124px]" aria-label={`Role for ${m.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["owner", "admin", "member"] as const).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(m)}
                  aria-label={`Remove ${m.name}`}
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

function InviteDialog({ onAdded }: { onAdded: (m: Member) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = name.trim().length > 0 && emailOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      onAdded(await api.addMember({ name: name.trim(), email: email.trim(), role }));
      setName("");
      setEmail("");
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
        <Button>
          <Plus className="size-4" />
          Add member
        </Button>
      </span>

      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add a team member</DialogTitle>
            <DialogDescription>
              This records them in the workspace. No invitation email is sent — there is no auth system behind this
              yet.
            </DialogDescription>
          </DialogHeader>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="m-email">Email</Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {email && !emailOk && <p className="text-xs text-destructive">That is not an email address.</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["owner", "admin", "member"] as const).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- notifications */

function NotificationsCard() {
  const { settings, settingsState } = useWorkspace();
  const [prefs, setPrefs] = useState<NotificationPrefs>(settings.notifications ?? DEFAULT_NOTIFICATIONS);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => setPrefs(settings.notifications ?? DEFAULT_NOTIFICATIONS), [settings.notifications]);

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    setNotice(null);
    try {
      await api.saveSettings({
        name: settings.name,
        slug: settings.slug,
        timezone: settings.timezone,
        notifications: next,
      });
      settingsState.reload();
    } catch (e) {
      setPrefs(prefs);
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-6 p-6">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-lg">Notifications</CardTitle>
        <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
          Preferences are stored against the workspace. Crawl failures already surface in the bell; the rest are read
          by whatever delivery job you wire up.
        </p>
      </CardHeader>
      <CardContent className="gap-5">
        {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

        {(Object.keys(NOTIFICATION_COPY) as Array<keyof NotificationPrefs>).map((key) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm">{NOTIFICATION_COPY[key].label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{NOTIFICATION_COPY[key].hint}</p>
            </div>
            <Switch
              checked={Boolean(prefs[key])}
              onCheckedChange={(v) => toggle(key, v)}
              disabled={saving}
              aria-label={NOTIFICATION_COPY[key].label}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- runtime */

function RuntimeCard() {
  const runtime = useAsync(() => api.runtime(), []);
  const { services } = useWorkspace();
  const r = runtime.data;

  return (
    <>
      <Card className="gap-6 p-6">
        <CardHeader className="gap-1.5">
          <CardTitle className="text-lg">Backend</CardTitle>
          <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
            How the API this dashboard talks to is configured. Read-only — change these with environment variables and
            restart the server.
          </p>
        </CardHeader>

        <CardContent className="gap-4">
          {runtime.error ? (
            <p className="text-sm text-destructive">{runtime.error}</p>
          ) : !r ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {r.user_agent_is_placeholder && (
                <Banner tone="error">
                  <span className="flex items-start gap-2.5">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <strong>The crawler is still using the placeholder contact address.</strong> Set a real one in{" "}
                      <code className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs">CRAWLER_USER_AGENT</code>{" "}
                      before running this at any scale — site owners have no way to reach you otherwise.
                    </span>
                  </span>
                </Banner>
              )}

              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Item label="API endpoint" value={API_URL} mono />
                <Item label="Database host" value={r.database_host} mono />
                <Item label="Model" value={r.signal_model} mono />
                <Item label="Model gateway" value={r.llm_base_url} mono />
                <Item label="Crawler concurrency" value={String(r.crawler_concurrency)} />
                <Item label="Per-host delay" value={`${fmtInt(r.per_host_delay_ms)} ms`} />
                <Item label="robots.txt" value={r.respect_robots ? "respected" : "ignored"} />
                <Item label="Services configured" value={fmtInt(services.data?.length ?? 0)} />
                <Item label="Crawler user agent" value={r.crawler_user_agent} mono full />
              </dl>

              <div className="border-t border-border pt-5">
                <p className="text-sm font-medium">API keys</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <KeyBadge
                    label={`Model (${r.llm_key_source})`}
                    set={r.llm_key_set}
                    required
                  />
                  <KeyBadge label="Crunchbase" set={r.crunchbase_key_set} />
                  <KeyBadge label="NewsAPI" set={r.newsapi_key_set} />
                </div>
                {!r.llm_key_set && (
                  <p className="mt-3 text-sm text-destructive">
                    Without a model key the evaluate and outreach steps cannot run, so nothing new will ever be
                    scored. Add one under Settings → Model.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="gap-5 p-6">
        <CardHeader className="gap-1.5">
          <CardTitle className="text-lg">Services</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each service carries its own signal questions and ICP. They are seeded from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">config/seed.json</code>.
          </p>
        </CardHeader>
        <CardContent className="gap-3">
          {(services.data ?? []).map((s) => (
            <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{s.key}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="muted">{fmtInt(s.question_count)} questions</Badge>
                <Button asChild variant="outline" size="sm">
                  <Link to="/signals">Configure</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function Item({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1", full && "sm:col-span-2")}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("break-all text-sm", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function KeyBadge({ label, set, required }: { label: string; set: boolean; required?: boolean }) {
  return (
    <Tooltip label={set ? `${label} key is set on the server` : required ? `${label} key is required and missing` : `${label} key is optional and not set`}>
      <span>
        <Badge variant={set ? "positive" : required ? "critical" : "muted"}>
          {set ? <Check className="size-3" /> : <X className="size-3" />}
          {label}
        </Badge>
      </span>
    </Tooltip>
  );
}
