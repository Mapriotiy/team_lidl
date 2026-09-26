/**
 * Loading, error and empty states.
 *
 * The mockups only drew the happy path. These carry the same visual language
 * and say what actually went wrong and what to do about it, because an API
 * that is simply not running is the most common state during development.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function Loading({ label = "Loading", rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <Card className={cn("gap-4 p-6", className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <RefreshCw className="size-4 animate-spin" />
        {label}…
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${100 - i * 11}%` }} />
        ))}
      </div>
    </Card>
  );
}

export function ErrorState({
  error,
  what,
  onRetry,
  hint,
  className,
}: {
  error: string;
  what?: string;
  onRetry?: () => void;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-3 border-destructive/30 p-6", className)} role="alert">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="size-4 text-destructive" />
        <p className="font-semibold">{what ? `Could not load ${what}` : "Something went wrong"}</p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{error}</p>
      {hint && <p className="text-sm leading-6 text-muted-foreground">{hint}</p>}
      {onRetry && (
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("items-center gap-4 p-10 text-center", className)}>
      <Icon className="size-9 text-muted-foreground" />
      <div className="flex flex-col gap-2">
        <p className="font-medium">{title}</p>
        {body && <p className="mx-auto max-w-[56ch] text-sm leading-6 text-muted-foreground">{body}</p>}
      </div>
      {action}
    </Card>
  );
}

/** Inline success / failure feedback after a write. */
export function Banner({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "ok" | "error";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-border bg-muted text-foreground",
    ok: "border-[oklch(0.86_0.09_155)] bg-[oklch(0.96_0.04_155)] text-[oklch(0.36_0.11_155)]",
    error: "border-destructive/30 bg-destructive/8 text-destructive",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-4 py-3 text-sm leading-6", tones[tone], className)}
    >
      {children}
    </div>
  );
}
