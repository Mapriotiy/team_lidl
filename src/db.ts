import pg from "pg";
import { readFileSync } from "node:fs";
import { settings } from "./settings.js";

/**
 * Local Docker Postgres has no TLS listener; a hosted instance (Supabase's pooler
 * included) requires it. Detect from the host rather than hardcoding one or the other,
 * so the same code runs against either without an env flag to remember.
 */
function needsSsl(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export const pool = new pg.Pool({
  connectionString: settings.databaseUrl,
  max: 10,
  // rejectUnauthorized: false because Supabase's pooler cert chain isn't always in
  // Node's default trust store; the connection is still encrypted, just not pinned to
  // a CA. Pin it with `ssl.ca` (download from Project Settings -> Database) if you need that.
  ssl: needsSsl(settings.databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

export async function initSchema(): Promise<void> {
  await pool.query(readFileSync("db/schema.sql", "utf8"));
}
