/**
 * OpenAI-compatible chat client.
 *
 * AgentRouter (the default) fronts thirty-odd providers behind one key and one
 * schema, so the same code reaches Claude, GPT, DeepSeek or a local Ollama
 * depending only on the base URL and model string the sales manager saves.
 *
 * Structured output is the hard part of being provider-neutral: `json_schema`
 * response formats are supported by some models behind the gateway and rejected
 * by others. So this degrades in three steps - strict json_schema, then plain
 * json_object, then prose - and always validates the result with zod rather
 * than trusting the transport. The schema is also written into the prompt, so
 * even the weakest path has been told exactly what to return.
 */
import { z } from "zod";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "./json-schema.js";
import { loadLlmConfig } from "./config.js";
import type { LlmConfig } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionUsage {
  input: number;
  output: number;
  cached: number;
}

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

/** Long evidence packs take a while; the default fetch timeout is too short. */
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 180_000);

/**
 * How long to wait before retrying a rate-limited request.
 *
 * Providers say so in `Retry-After` (seconds, or a date) and some repeat it in
 * the error text - Groq answers "try again in 24.5s". Honour whichever is
 * present rather than guessing, and fall back to a widening delay.
 */
function retryDelayMs(res: Response, detail: string, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
    const when = Date.parse(header);
    if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  }
  const spoken = detail.match(/try again in ([\d.]+)s/i);
  if (spoken) return Math.ceil(Number(spoken[1]) * 1000);
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate limits are worth waiting out; a bad key or a too-large body is not. */
const RETRY_LIMIT = Number(process.env.LLM_RATE_LIMIT_RETRIES ?? 4);

async function post(config: LlmConfig, path: string, body: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await postOnce(config, path, body);
    } catch (err) {
      const retryable = err instanceof LlmError && (err.status === 429 || err.status === 503);
      if (!retryable || attempt >= RETRY_LIMIT) throw err;
      const wait = (err as LlmError & { retryAfterMs?: number }).retryAfterMs ?? 2_000 * 2 ** attempt;
      console.log(`  rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${RETRY_LIMIT})`);
      await sleep(wait);
    }
  }
}

async function postOnce(config: LlmConfig, path: string, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        ...(config.extraHeaders ?? {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail =
        parsed?.error?.message ?? parsed?.message ?? raw.slice(0, 300) ?? res.statusText;
      const error = new LlmError(
        `${config.model}: ${detail || `request failed (${res.status})`}`,
        res.status,
      ) as LlmError & { retryAfterMs?: number };
      if (res.status === 429 || res.status === 503) {
        error.retryAfterMs = retryDelayMs(res, String(detail ?? ""), 0);
      }
      throw error;
    }

    // A 200 carrying something other than JSON is not a success. Marketing pages
    // and login redirects both arrive this way, and returning null here let a
    // misconfigured base URL look like a model that merely answered in prose.
    if (parsed === null) {
      const servedHtml = /^\s*<(?:!doctype|html)/i.test(raw);
      const hint = servedHtml
        ? ` - it served a web page, which usually means the base URL is missing its version suffix (try ${config.baseUrl}/v1)`
        : ` - first bytes were: ${raw.slice(0, 120).replace(/\s+/g, " ").trim() || "(empty body)"}`;
      throw new LlmError(`${config.baseUrl}${path} did not return JSON${hint}`, 502);
    }

    return parsed;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new LlmError(`${config.model} did not respond within ${Math.round(TIMEOUT_MS / 1000)}s`, 408);
    }
    throw new LlmError(`Cannot reach ${config.baseUrl}: ${(err as Error).message}`, 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull the JSON object out of a completion. Models wrap it in ``` fences, add a
 * sentence of preamble, or both; this finds the outermost balanced object
 * rather than regexing for the first `{`.
 */
export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

const usageOf = (payload: any): CompletionUsage => ({
  input: Number(payload?.usage?.prompt_tokens ?? 0),
  output: Number(payload?.usage?.completion_tokens ?? 0),
  cached: Number(payload?.usage?.prompt_tokens_details?.cached_tokens ?? 0),
});

const contentOf = (payload: any): string => {
  const message = payload?.choices?.[0]?.message;
  if (!message) return "";
  // Some gateways return content as an array of parts rather than a string.
  if (Array.isArray(message.content)) {
    return message.content.map((p: any) => (typeof p === "string" ? p : (p?.text ?? ""))).join("");
  }
  return typeof message.content === "string" ? message.content : "";
};

export interface ChatJsonOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  /** Used in the prompt and as the json_schema name. */
  schemaName: string;
  maxTokens?: number;
  config?: LlmConfig;
}

export interface ChatJsonResult<T> {
  data: T;
  usage: CompletionUsage;
  model: string;
  /** Which structured-output strategy actually worked, for logging. */
  strategy: "json_schema" | "json_object" | "prose";
}

/**
 * One chat round trip that must come back as an object matching `schema`.
 * Throws LlmError if no strategy produced valid JSON.
 */
export async function chatJson<T>(options: ChatJsonOptions<T>): Promise<ChatJsonResult<T>> {
  const config = options.config ?? (await loadLlmConfig());
  if (!config.apiKey) {
    throw new LlmError(
      "No model API key configured. Add one under Settings -> Model, or set LLM_API_KEY on the server.",
      401,
    );
  }

  const jsonSchema = zodToJsonSchema(options.schema);
  const messages: ChatMessage[] = [
    { role: "system", content: options.system },
    {
      role: "user",
      content:
        `${options.user}\n\n` +
        `Reply with a single JSON object and nothing else - no prose, no markdown fence. ` +
        `It must match this JSON Schema exactly:\n${JSON.stringify(jsonSchema, null, 2)}`,
    },
  ];

  const base = {
    model: config.model,
    messages,
    max_tokens: options.maxTokens ?? config.maxTokens,
    temperature: config.temperature,
  };

  const attempts: Array<{ strategy: ChatJsonResult<T>["strategy"]; body: Record<string, unknown> }> = [
    {
      strategy: "json_schema",
      body: {
        ...base,
        response_format: {
          type: "json_schema",
          json_schema: { name: options.schemaName, schema: jsonSchema, strict: true },
        },
      },
    },
    { strategy: "json_object", body: { ...base, response_format: { type: "json_object" } } },
    { strategy: "prose", body: base },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    let payload: any;
    try {
      payload = await post(config, "/chat/completions", attempt.body);
    } catch (err) {
      lastError = err as Error;
      // A 4xx here usually means "this model does not accept that
      // response_format" - worth trying the next strategy. A 401 or 5xx will
      // not improve, so stop and report it.
      const status = err instanceof LlmError ? err.status : 0;
      if (status === 401 || status === 403 || status === 429 || status >= 500 || status === 0 || status === 408) {
        throw err;
      }
      continue;
    }

    const text = contentOf(payload);
    const json = extractJson(text);
    if (!json) {
      lastError = new LlmError(`${config.model} returned no JSON object (${attempt.strategy})`);
      continue;
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(json);
    } catch (err) {
      lastError = new LlmError(`${config.model} returned malformed JSON: ${(err as Error).message}`);
      continue;
    }

    const validated = options.schema.safeParse(candidate);
    if (!validated.success) {
      lastError = new LlmError(
        `${config.model} returned JSON that does not match ${options.schemaName}: ${validated.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("; ")}`,
      );
      continue;
    }

    return {
      data: validated.data,
      usage: usageOf(payload),
      model: payload?.model ?? config.model,
      strategy: attempt.strategy,
    };
  }

  throw lastError ?? new LlmError("the model returned nothing usable");
}

/* ------------------------------------------------------------ diagnostics */

const ModelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([]),
});

/** `GET /models` on the configured gateway, for the Settings dropdown. */
export async function listModels(config?: LlmConfig): Promise<string[]> {
  const cfg = config ?? (await loadLlmConfig());
  if (!cfg.apiKey) throw new LlmError("No API key configured", 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${cfg.baseUrl}/models`, {
      headers: { ...(cfg.extraHeaders ?? {}), Authorization: `Bearer ${cfg.apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new LlmError(`Model list unavailable (${res.status})`, res.status);
    const parsed = ModelListSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    return [...new Set(parsed.data.data.map((m) => m.id))].sort();
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if ((err as Error).name === "AbortError") throw new LlmError("Model list timed out", 408);
    throw new LlmError(`Cannot reach ${cfg.baseUrl}: ${(err as Error).message}`, 0);
  } finally {
    clearTimeout(timer);
  }
}

/** A cheap real round trip, so "Test connection" means something. */
export async function testConnection(config?: LlmConfig): Promise<{
  ok: true;
  model: string;
  latency_ms: number;
  reply: string;
  usage: CompletionUsage;
}> {
  const cfg = config ?? (await loadLlmConfig());
  if (!cfg.apiKey) throw new LlmError("No API key configured", 401);

  const started = Date.now();
  const payload = await post(cfg, "/chat/completions", {
    model: cfg.model,
    // Reasoning models (gpt-oss, o-series, DeepSeek R1) spend output tokens
    // thinking before they write any content, so a tight cap comes back with
    // an empty string and finish_reason "length" - a working model that looks
    // dead. 256 is still a cheap round trip and leaves room to answer.
    max_tokens: 256,
    temperature: 0,
    messages: [
      { role: "system", content: "You are a connection test. Reply with exactly: OK" },
      { role: "user", content: "Reply with exactly: OK" },
    ],
  });

  // An empty completion is a failed test, not a passing one. A gateway that
  // accepts the request but has nothing behind the model name answers exactly
  // this way, and reporting it as OK is how a dead configuration gets saved.
  const reply = contentOf(payload).trim();
  if (!reply) {
    const ranOutOfRoom = payload?.choices?.[0]?.finish_reason === "length";
    throw new LlmError(
      ranOutOfRoom
        ? `${cfg.model} used its entire output budget before writing an answer - if it is a reasoning model, raise max tokens`
        : `${cfg.model} accepted the request but returned an empty completion - check that this gateway actually serves that model`,
      502,
    );
  }

  return {
    ok: true,
    model: payload?.model ?? cfg.model,
    latency_ms: Date.now() - started,
    reply: reply.slice(0, 80),
    usage: usageOf(payload),
  };
}
