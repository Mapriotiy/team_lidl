/**
 * Where the model configuration comes from.
 *
 * Precedence is database first, environment second. The sales manager edits the
 * row from the Settings screen; the environment stays as the fallback so an
 * existing deployment - or a CI run with no database writes - keeps working.
 */
import { q, one } from "../db.js";
import { settings } from "../settings.js";
import { decryptSecret, encryptSecret, hintFor } from "./crypto.js";

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  /** Sent with every request to the gateway, alongside the key. */
  extraHeaders: Record<string, string>;
  /** Where the key came from, for diagnostics. */
  keySource: "database" | "environment" | "none";
}

export interface LlmSettingsRow {
  base_url: string;
  model: string;
  api_key_cipher: string | null;
  api_key_hint: string | null;
  max_tokens: number;
  temperature: string | number;
  extra_headers: Record<string, string> | null;
  updated_at: string;
}

/**
 * Header names and values have to be well-formed or `fetch` throws, which would
 * surface as an unhelpful "Cannot reach ..." rather than a configuration
 * problem. Anything malformed is dropped here instead.
 */
export function cleanHeaders(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const name = rawName.trim();
    const value = String(rawValue ?? "").trim();
    // RFC 7230 token for the name; no control characters in the value.
    if (!name || !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue;
    if (!value || /[\r\n]/.test(value)) continue;
    // Never let a header override what the client sets deliberately.
    if (["authorization", "content-type"].includes(name.toLowerCase())) continue;
    out[name] = value;
  }
  return out;
}

const DEFAULTS = {
  baseUrl: "https://agentrouter.org/v1",
  model: "claude-opus-5",
  maxTokens: 8000,
  temperature: 0.2,
};

/** Trailing slashes break `${base}/chat/completions`. */
export const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, "");

async function readRow(): Promise<LlmSettingsRow | undefined> {
  try {
    return await one<LlmSettingsRow>(`SELECT * FROM llm_settings WHERE id`);
  } catch {
    // Table missing means the operator has not run db:init since this shipped.
    return undefined;
  }
}

export async function loadLlmConfig(): Promise<LlmConfig> {
  const row = await readRow();

  const fromDb = row?.api_key_cipher ? await decryptSecret(row.api_key_cipher) : null;
  const fromEnv = settings.llmApiKey;
  const apiKey = fromDb || fromEnv || "";

  return {
    baseUrl: normalizeBaseUrl(row?.base_url || settings.llmBaseUrl || DEFAULTS.baseUrl),
    model: row?.model || settings.signalModel || DEFAULTS.model,
    apiKey,
    maxTokens: Number(row?.max_tokens) || DEFAULTS.maxTokens,
    temperature: row?.temperature === undefined ? DEFAULTS.temperature : Number(row.temperature),
    extraHeaders: cleanHeaders(row?.extra_headers),
    keySource: fromDb ? "database" : fromEnv ? "environment" : "none",
  };
}

/** The shape the dashboard reads. Never includes the key itself. */
export async function describeLlmConfig() {
  const row = await readRow();
  const config = await loadLlmConfig();
  return {
    base_url: config.baseUrl,
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    extra_headers: config.extraHeaders,
    key_set: Boolean(config.apiKey),
    key_hint: row?.api_key_hint ?? (settings.llmApiKey ? hintFor(settings.llmApiKey) : null),
    key_source: config.keySource,
    updated_at: row?.updated_at ?? null,
    /** True when no APP_SECRET is set and the server generated one itself. */
    env_key_available: Boolean(settings.llmApiKey),
  };
}

export interface SaveLlmInput {
  base_url?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  /**
   * undefined  - leave the stored key alone
   * ""         - clear it and fall back to the environment
   * "sk-..."   - replace it
   */
  api_key?: string;
  /** Replaces the stored set wholesale; `{}` clears it. */
  extra_headers?: Record<string, string>;
}

export async function saveLlmConfig(input: SaveLlmInput): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, value: unknown) => {
    vals.push(value);
    sets.push(`${col} = $${vals.length}`);
  };

  if (input.base_url !== undefined) {
    const url = normalizeBaseUrl(input.base_url);
    if (!/^https?:\/\/.+/i.test(url)) throw new Error("Base URL must start with http:// or https://");
    push("base_url", url);
  }
  if (input.model !== undefined) {
    const model = String(input.model).trim();
    if (!model) throw new Error("Model is required");
    push("model", model);
  }
  if (input.max_tokens !== undefined) {
    push("max_tokens", Math.max(256, Math.min(128_000, Math.round(Number(input.max_tokens) || DEFAULTS.maxTokens))));
  }
  if (input.temperature !== undefined) {
    push("temperature", Math.max(0, Math.min(2, Number(input.temperature) || 0)));
  }
  if (input.extra_headers !== undefined) {
    push("extra_headers", JSON.stringify(cleanHeaders(input.extra_headers)));
  }
  if (input.api_key !== undefined) {
    const key = String(input.api_key).trim();
    if (key) {
      push("api_key_cipher", await encryptSecret(key));
      push("api_key_hint", hintFor(key));
    } else {
      push("api_key_cipher", null);
      push("api_key_hint", null);
    }
  }

  if (!sets.length) return;
  sets.push("updated_at = now()");
  await q(`UPDATE llm_settings SET ${sets.join(", ")} WHERE id`, vals);
}
