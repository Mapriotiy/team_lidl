import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        type === "number" && "tabular-nums",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "flex w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
