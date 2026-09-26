/**
 * Verify the stored-model plumbing end to end, without changing anything.
 *
 *   npx tsx src/cli/llmcheck.ts
 *
 * Three questions, in order:
 *   1. Does the key survive the encrypt -> store -> read -> decrypt round trip?
 *      (Run against a sentinel value; the real ciphertext is restored byte for
 *      byte afterwards, so the stored key is never disturbed.)
 *   2. What does the gateway say to the key we actually hold?
 *   3. Does adding the headers a normal OpenAI client sends change that answer?
 *      A gateway that refuses a bare request but accepts an identified one is
 *      rejecting the client, not the credential - a different bug entirely.
 *
 * Nothing here prints the key. Only its length, shape and the gateway's reply.
 */
import { q, one, pool } from "../db.js";
import { loadLlmConfig } from "../llm/config.js";
import { encryptSecret, decryptSecret, hintFor, secretIsManaged } from "../llm/crypto.js";

const line = (s = "") => console.log(s);

/* ------------------------------------------------- 1. what is stored today */

const row = await one<{ base_url: string; model: string; api_key_cipher: string | null; api_key_hint: string | null }>(
  `SELECT base_url, model, api_key_cipher, api_key_hint FROM llm_settings WHERE id`,
);
const config = await loadLlmConfig();

line("=== stored configuration ===");
line(`base_url    ${config.baseUrl}`);
line(`model       ${config.model}`);
line(`key_source  ${config.keySource}`);
line(`secret      ${(await secretIsManaged()) ? "server-generated (APP_SECRET unset)" : "from APP_SECRET"}`);
line(`stored hint ${row?.api_key_hint ?? "(none)"}`);
line(`key length  ${config.apiKey.length}`);
line(`key shape   ${config.apiKey ? hintFor(config.apiKey) : "(empty)"}`);

// A hint that disagrees with the decrypted key means the ciphertext could not
// be read - the UI would still show a key as configured.
if (row?.api_key_hint && config.apiKey && row.api_key_hint !== hintFor(config.apiKey)) {
  line("MISMATCH    the stored hint does not match the decrypted key");
} else if (row?.api_key_cipher && !config.apiKey) {
  line("MISMATCH    a ciphertext is stored but decrypted to nothing (APP_SECRET changed?)");
}

/* --------------------------------------------- 2. crypto round trip (safe) */

line();
line("=== crypto round trip ===");
const sentinel = "sk-test-" + "roundtrip".repeat(3) + "-END";
const original = row?.api_key_cipher ?? null;
let verdict: string;
try {
  const cipher = await encryptSecret(sentinel);
  await q(`UPDATE llm_settings SET api_key_cipher=$1 WHERE id`, [cipher]);
  const readBack = await one<{ api_key_cipher: string | null }>(`SELECT api_key_cipher FROM llm_settings WHERE id`);
  const decrypted = await decryptSecret(readBack?.api_key_cipher ?? null);
  verdict = decrypted === sentinel ? "PASS - the key survives storage exactly" : `FAIL - got ${JSON.stringify(decrypted)}`;
} finally {
  // Restore whatever was there before, even if the check threw.
  await q(`UPDATE llm_settings SET api_key_cipher=$1 WHERE id`, [original]);
}
const restored = await decryptSecret(
  (await one<{ api_key_cipher: string | null }>(`SELECT api_key_cipher FROM llm_settings WHERE id`))?.api_key_cipher ??
    null,
);
line(verdict);
line(`restored    ${restored === config.apiKey ? "original key is back, unchanged" : "RESTORE FAILED"}`);

/* --------------------------------------- 3. is it the key or the client? */

const body = {
  model: config.model,
  max_tokens: 8,
  temperature: 0,
  messages: [{ role: "user", content: "Reply with: OK" }],
};

const variants: Array<{ name: string; headers: Record<string, string> }> = [
  {
    name: "as the app sends it today",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
  },
  {
    name: "+ User-Agent",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "User-Agent": "orange-signal/0.1 (+https://github.com/orange-systems/orange-signal)",
    },
  },
  {
    name: "+ User-Agent, Accept, Referer/Title",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "User-Agent": "orange-signal/0.1",
      Accept: "application/json",
      "HTTP-Referer": "https://orange-signal.local",
      "X-Title": "Orange Signal",
    },
  },
];

line();
line(`=== POST ${config.baseUrl}/chat/completions ===`);
for (const variant of variants) {
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: variant.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const text = (await res.text()).replace(/\s+/g, " ").trim();
    line(`${res.status}  ${variant.name}`);
    line(`      ${text.slice(0, 220)}`);
  } catch (err) {
    line(`ERR  ${variant.name}: ${(err as Error).message}`);
  }
}

await pool.end();
