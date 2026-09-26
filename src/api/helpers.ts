/** Shared plumbing for the API routers. */
import type express from "express";
import { one } from "../db.js";

export interface ServiceRow {
  id: string;
  key: string;
  name: string;
}

/** Async handlers reject into next() instead of hanging the request. */
export const wrap =
  (fn: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const serviceByKey = (key: string) =>
  one<ServiceRow>(`SELECT id, key, name FROM services WHERE key=$1`, [key]);

/**
 * Resolve ?service=xxx. Returns undefined when the parameter was absent (the
 * caller decides whether that is allowed) and throws a 404-able marker when it
 * was present but unknown, so a typo never silently widens a query to all
 * services.
 */
export async function resolveService(raw: unknown): Promise<ServiceRow | null | undefined> {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) return undefined;
  return (await serviceByKey(key)) ?? null;
}

export const asInt = (v: unknown, fallback: number, max = 1000): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n)));
};

export const asStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
