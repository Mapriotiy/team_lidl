import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The h2 + one-line description + right-hand actions every screen opens with. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
