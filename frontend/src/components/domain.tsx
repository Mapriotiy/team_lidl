/**
 * Domain-specific display pieces: score bands, verdicts, the score ring.
 *
 * Band colour is the one place semantic colour is used for scoring, and it is
 * never the brand accent: hot/warm/nurture/cold read as temperature, and every
 * chip carries its own text label so the colour is reinforcement, not the only
 * channel of meaning.
 */
import { Building2 } from "lucide-react";
import type { Band, Polarity, SourceKind, Verdict, Weight } from "@/api";
import { BAND_THRESHOLDS } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const BAND_STYLE: Record<Band, string> = {
  hot: "bg-[oklch(0.94_0.07_35)] text-[oklch(0.44_0.16_35)]",
  warm: "bg-[oklch(0.95_0.07_85)] text-[oklch(0.42_0.13_75)]",
  nurture: "bg-[oklch(0.94_0.05_245)] text-[oklch(0.42_0.13_245)]",
  cold: "bg-muted text-muted-foreground",
  disqualified: "bg-destructive/12 text-destructive line-through decoration-1",
};

const BAND_HELP: Record<Band, string> = {
  hot: `Score ${BAND_THRESHOLDS.hot} or above`,
  warm: `Score ${BAND_THRESHOLDS.warm}–${BAND_THRESHOLDS.hot - 1}`,
  nurture: `Score ${BAND_THRESHOLDS.nurture}–${BAND_THRESHOLDS.warm - 1}`,
  cold: `Score below ${BAND_THRESHOLDS.nurture}`,
  disqualified: "A disqualifying signal fired — excluded from ranking",
};

export function BandChip({ band, className }: { band: Band; className?: string }) {
  return (
    <Tooltip label={BAND_HELP[band]}>
      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", BAND_STYLE[band], className)}>
        {band}
      </span>
    </Tooltip>
  );
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const map = {
    yes: { label: "confirmed", variant: "positive" as const },
    no: { label: "not found", variant: "muted" as const },
    unknown: { label: "unknown", variant: "outline" as const },
  };
  const v = map[verdict];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function PolarityChip({ polarity }: { polarity: Polarity }) {
  const variant = polarity === "positive" ? "positive" : polarity === "negative" ? "warning" : "critical";
  return <Badge variant={variant}>{polarity}</Badge>;
}

export function WeightChip({ weight }: { weight: Weight }) {
  const points = { high: 3, medium: 2, low: 1 }[weight];
  return (
    <Tooltip label={`${weight} weight — worth ${points} point${points > 1 ? "s" : ""} of intent`}>
      <span>
        <Badge variant="outline">{weight}</Badge>
      </span>
    </Tooltip>
  );
}

export function SourceKindChip({ kind, active = true }: { kind: SourceKind; active?: boolean }) {
  return <Badge variant={active ? "secondary" : "outline"}>{kind}</Badge>;
}

/**
 * The big score dial from the lead detail comp. Drawn as SVG so the arc is a
 * real proportion of the score rather than a full ring that always looks 100%.
 */
export function ScoreRing({
  value,
  max = 100,
  size = 192,
  thickness = 12,
  caption,
  muted = false,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  caption?: string;
  muted?: boolean;
}) {
  const safe = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (safe / max) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${safe.toFixed(1)} out of ${max}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={muted ? "var(--muted-foreground)" : "var(--primary)"}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold tabular-nums leading-none">{safe.toFixed(0)}</span>
        <span className="mt-1 text-sm text-muted-foreground">{caption ?? `/ ${max}`}</span>
      </div>
    </div>
  );
}

/** Square company mark. No logo service is wired up, so this is initials. */
export function CompanyMark({ name, size = "md" }: { name?: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-20 text-2xl" }[size];
  const letters = (name ?? "").trim().slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl border border-border bg-card font-semibold",
        dims,
      )}
      aria-hidden="true"
    >
      {letters || <Building2 className="size-1/2 text-muted-foreground" />}
    </div>
  );
}
