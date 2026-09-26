/** The small primitives - avatar, tooltip, label, separator, skeleton, progress. */
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------- avatar */

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex size-full items-center justify-center rounded-full bg-muted text-xs font-semibold", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/* ---------------------------------------------------------------- tooltip */

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-lg bg-foreground px-3 py-2 text-xs leading-5 text-background",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** The common case: wrap a trigger, give it a string. */
function Tooltip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  if (!label) return <>{children}</>;
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  );
}

/* ------------------------------------------------------- label / separator */

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium leading-none peer-disabled:opacity-70", className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

/** Uppercase section eyebrow, used above grouped fields. */
function FieldLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  );
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

/* ------------------------------------------------------ skeleton / progress */

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

/**
 * A labelled bar. `value` is 0..1. Rendered as a real <progress> equivalent
 * with ARIA so it is not just a coloured div to a screen reader.
 */
function Meter({
  value,
  label,
  className,
  barClassName,
}: {
  value: number;
  label?: string;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full bg-primary", barClassName)} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

export {
  Avatar,
  AvatarFallback,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  Tooltip,
  Label,
  FieldLabel,
  Separator,
  Skeleton,
  Meter,
};
