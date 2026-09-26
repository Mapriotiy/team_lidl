import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
 * Semantic colours are deliberately separate from the monochrome primary:
 * "positive" / "warning" / "critical" encode state, and the near-black accent
 * never means "good". Values are OKLCH so they track the token palette.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        positive: "bg-[oklch(0.94_0.08_155)] text-[oklch(0.38_0.12_155)]",
        warning: "bg-[oklch(0.95_0.09_85)] text-[oklch(0.42_0.13_75)]",
        critical: "bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
