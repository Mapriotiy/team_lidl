/**
 * Formatting helpers shared across the screens.
 *
 * Every one of these takes the real shape the API returns - including null and
 * Postgres numerics that arrive as strings - and returns something safe to put
 * straight into the DOM. A dash means "we do not know", never zero.
 */

export const fmtInt = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? "—" : Number(n).toLocaleString();

export const fmtScore = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(1);

export const fmtPct = (fraction: number, digits = 0): string =>
  Number.isFinite(fraction) ? `${(fraction * 100).toFixed(digits)}%` : "—";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "2h ago", "yesterday", "May 27" - the phrasing the mockups used. */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const seconds = (Date.now() - d.getTime()) / 1000;
  if (seconds < 0) return fmtDate(iso);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172_800) return "yesterday";
  if (seconds < 86_400 * 7) return `${Math.floor(seconds / 86_400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtAge(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "undated";
  if (days < 1) return "today";
  if (days < 45) return `${Math.round(days)}d old`;
  if (days < 365) return `${Math.round(days / 30)}mo old`;
  const years = days / 365;
  return `${years.toFixed(years < 10 ? 1 : 0)}y old`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

/** Initials for an avatar fallback. "Orange Systems" -> "OS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A signed delta, for the "vs. previous period" pills. */
export function fmtDelta(current: number, previous: number): { label: string; direction: "up" | "down" | "flat" } {
  if (!Number.isFinite(previous) || previous === 0) {
    return current > 0 ? { label: "new", direction: "up" } : { label: "no change", direction: "flat" };
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return { label: "no change", direction: "flat" };
  return {
    label: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
    direction: pct > 0 ? "up" : "down",
  };
}
