/**
 * The persistent chrome: sidebar, top bar, command palette.
 *
 * The exported screens each carried their own copy of this markup with the
 * active item hardcoded. Here it exists once and reads the active item from
 * the router, so adding a screen cannot leave eight sidebars out of sync.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Citrus,
  Database,
  LayoutDashboard,
  Moon,
  Radio,
  Search,
  Send,
  Settings as SettingsIcon,
  Sun,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import sidebarResearcher from "@/assets/sidebar-researcher.png";
import { api, API_URL } from "@/api";
import type { Lead } from "@/api";
import { useAsync } from "@/hooks";
import { useWorkspace } from "@/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, Skeleton, Tooltip, TooltipProvider } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, fmtScore, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/signals", label: "Signals", icon: Radio },
  { to: "/icp", label: "ICP & Scoring", icon: Target },
  { to: "/sources", label: "Data Sources", icon: Database },
  { to: "/outreach", label: "Outreach", icon: Send },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/* ------------------------------------------------------------- breadcrumb */

type Crumb = { label: string; to?: string };

const BreadcrumbContext = createContext<(crumbs: Crumb[] | null) => void>(() => {});

/**
 * Lets a route replace the breadcrumb - the lead detail screen shows
 * "Leads / Datadog" rather than the nav label for its path.
 */
export function useBreadcrumb(crumbs: Crumb[] | null, deps: unknown[] = []) {
  const set = useContext(BreadcrumbContext);
  useEffect(() => {
    set(crumbs);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* -------------------------------------------------------------- app shell */

export function AppShell() {
  const [override, setOverride] = useState<Crumb[] | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  const setCrumbs = useCallback((c: Crumb[] | null) => setOverride(c), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = useMemo(
    () =>
      NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) ?? NAV[0],
    [location.pathname],
  );

  const crumbs: Crumb[] = override ?? [{ label: active.label }];

  return (
    <TooltipProvider delayDuration={300}>
      <BreadcrumbContext.Provider value={setCrumbs}>
        <div className="min-h-screen bg-background text-foreground">
          <Sidebar />
          <TopBar crumbs={crumbs} onOpenPalette={() => setPaletteOpen(true)} />
          <main className="ml-[248px] min-h-screen px-8 pb-12 pt-[116px]">
            <div className="mx-auto flex w-full max-w-[1424px] flex-col gap-6">
              <Outlet />
            </div>
          </main>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </BreadcrumbContext.Provider>
    </TooltipProvider>
  );
}

/* ---------------------------------------------------------------- sidebar */

function Sidebar() {
  const { settings, services, serviceKey } = useWorkspace();
  const questionCount = services.data?.find((s) => s.key === serviceKey)?.question_count ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-4 py-5">
      <Link to="/" className="flex items-center gap-2.5 px-2 pb-8">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary">
          <Citrus className="size-4 text-primary-foreground" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold tracking-tight text-white">orange signal</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
              )
            }
          >
            <Icon className="size-[18px]" strokeWidth={1.6} />
            <span className="flex-1">{label}</span>
            {to === "/signals" && questionCount > 0 && (
              <span className="text-xs tabular-nums opacity-70">{questionCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/*
        Decorative only, so it is hidden from assistive tech. It sits above the
        workspace chip and yields space to the nav first - on a short viewport
        it shrinks rather than pushing the chip out of view.
      */}
      <img
        aria-hidden="true"
        alt=""
        src={sidebarResearcher}
        className="pointer-events-none mx-auto mt-4 max-h-44 min-h-0 w-full shrink object-contain object-bottom"
      />

      <div className="mt-3 shrink-0 rounded-xl border border-sidebar-border bg-sidebar-chip p-3">
        <p className="truncate text-sm font-medium text-white">{settings.name}</p>
        <p className="mt-1 text-xs text-sidebar-muted">
          {services.data ? `${services.data.length} service${services.data.length === 1 ? "" : "s"}` : "loading…"}
        </p>
      </div>
    </aside>
  );
}

/* ----------------------------------------------------------------- top bar */

function TopBar({ crumbs, onOpenPalette }: { crumbs: Crumb[]; onOpenPalette: () => void }) {
  const { services, serviceKey, setServiceKey, settings, appearance, setAppearance } = useWorkspace();

  return (
    <header className="fixed inset-x-0 top-0 z-10 ml-[248px] flex h-20 items-center justify-between gap-6 border-b border-border bg-background px-8">
      <nav className="flex min-w-0 items-center gap-2" aria-label="Breadcrumb">
        <span className="text-sm text-muted-foreground">Workspace</span>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            {c.to && i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate text-sm text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : i < crumbs.length - 1 ? (
              <span className="truncate text-sm text-muted-foreground">{c.label}</span>
            ) : (
              <h1 className="truncate text-lg font-semibold">{c.label}</h1>
            )}
          </span>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        {services.loading && services.firstLoad ? (
          <Skeleton className="h-10 w-[184px] rounded-xl" />
        ) : services.data && services.data.length > 0 ? (
          <Select value={serviceKey} onValueChange={setServiceKey}>
            <SelectTrigger className="h-10 w-[184px]" aria-label="Service">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              {services.data.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            "flex h-10 w-[260px] items-center gap-2.5 rounded-xl border border-border bg-card px-3",
            "text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <Search className="size-[18px]" strokeWidth={1.7} />
          <span className="flex-1 truncate text-left">Search companies and screens…</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
        </button>

        <Tooltip label={appearance === "dark" ? "Switch to light" : "Switch to dark"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
            aria-label={appearance === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
          >
            {appearance === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
        </Tooltip>

        <NotificationsBell />

        <Avatar>
          <AvatarFallback>{initials(settings.name)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

/**
 * The bell shows real operational problems - failed fetches in the crawl log -
 * rather than a decorative dot. A crawl that silently stopped working is the
 * failure mode that actually costs this product its data.
 */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const log = useAsync(() => api.crawlLog(60), []);
  const failures = (log.data ?? []).filter((r) => r.status === "error").slice(0, 8);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label={failures.length ? `${failures.length} crawl problems` : "No crawl problems"}
        aria-expanded={open}
      >
        <span className="relative">
          <Bell className="size-[18px]" strokeWidth={1.7} />
          {failures.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-11 z-40 w-[380px] rounded-xl border border-border bg-popover p-4 shadow-[0px_20px_40px_-16px_rgba(0,0,0,0.3)]">
            <p className="text-sm font-medium">Crawl problems</p>
            <p className="mt-1 text-xs text-muted-foreground">Failed fetches from the last 60 log entries.</p>
            {failures.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing failed recently. {log.data?.length ? "Every recent fetch succeeded." : "The crawl log is empty."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {failures.map((f) => (
                  <li key={f.id} className="flex gap-2.5 border-b border-border pb-3 last:border-0 last:pb-0">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{f.source_name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.detail ?? f.url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(f.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/sources"
              onClick={() => setOpen(false)}
              className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Open Data sources
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- command palette */

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { serviceKey } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Only fetch once the palette is actually opened.
  const leads = useAsync(
    () => api.leads({ service: serviceKey || undefined, limit: 500 }),
    [serviceKey, open],
    open && Boolean(serviceKey),
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const needle = query.trim().toLowerCase();
  const pages = NAV.filter((n) => !needle || n.label.toLowerCase().includes(needle));
  const companies: Lead[] = !needle
    ? (leads.data ?? []).slice(0, 6)
    : (leads.data ?? [])
        .filter((l) => l.name.toLowerCase().includes(needle) || l.domain.toLowerCase().includes(needle))
        .slice(0, 8);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, or jump to a screen…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {pages.length > 0 && (
            <Section title="Screens">
              {pages.map(({ to, label, icon: Icon }) => (
                <Row key={to} onSelect={() => go(to)}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{label}</span>
                </Row>
              ))}
            </Section>
          )}

          <Section title={needle ? "Matching companies" : "Top leads"}>
            {!serviceKey ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Pick a service first.</p>
            ) : leads.loading && leads.firstLoad ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Loading companies…</p>
            ) : leads.error ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Could not reach {API_URL}. {leads.error}
              </p>
            ) : companies.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No company matches “{query}”.</p>
            ) : (
              companies.map((c) => (
                <Row key={c.id} onSelect={() => go(`/leads/${c.id}`)}>
                  <span className="flex-1 truncate">
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">{c.domain}</span>
                  </span>
                  <Badge variant="muted" className="tabular-nums">
                    {fmtScore(c.total)}
                  </Badge>
                </Row>
              ))
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ children, onSelect }: { children: ReactNode; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}
