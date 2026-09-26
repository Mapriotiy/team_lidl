import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class lists so a caller's utility always beats the component default. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
