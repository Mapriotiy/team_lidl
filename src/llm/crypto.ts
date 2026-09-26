/**
 * Encryption for the stored API key.
 *
 * The key is AES-256-GCM encrypted at rest so a database dump - or a Supabase
 * console session - does not hand over a working credential. This is not a
 * substitute for protecting the database; it removes the easiest way to lose
 * the key.
 *
 * The encryption secret comes from APP_SECRET when set. If it is not set, a
 * random one is generated on first use and stored in `app_secrets`, which keeps
 * a fresh install working with no extra setup at the cost of the secret living
 * beside the ciphertext. Set APP_SECRET in production - the UI says so.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { q, one } from "../db.js";

const SECRET_NAME = "llm_key_encryption";
let cached: Buffer | null = null;

/** 32 bytes derived from whatever secret material we have. */
async function encryptionKey(): Promise<{ key: Buffer; managed: boolean }> {
  const fromEnv = process.env.APP_SECRET;
  if (fromEnv) {
    cached = cached ?? createHash("sha256").update(fromEnv).digest();
    return { key: cached, managed: false };
  }

  const existing = await one<{ value: string }>(`SELECT value FROM app_secrets WHERE name=$1`, [SECRET_NAME]);
  if (existing) {
    return { key: createHash("sha256").update(existing.value).digest(), managed: true };
  }

  const generated = randomBytes(32).toString("hex");
  // ON CONFLICT DO NOTHING then re-read, so two workers racing on first boot
  // cannot end up using different secrets.
  await q(`INSERT INTO app_secrets (name, value) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING`, [
    SECRET_NAME,
    generated,
  ]);
  const row = await one<{ value: string }>(`SELECT value FROM app_secrets WHERE name=$1`, [SECRET_NAME]);
  return { key: createHash("sha256").update(row!.value).digest(), managed: true };
}

/** Whether the encryption secret is server-generated rather than operator-set. */
export async function secretIsManaged(): Promise<boolean> {
  return (await encryptionKey()).managed;
}

/** iv:tag:ciphertext, all hex. */
export async function encryptSecret(plain: string): Promise<string> {
  const { key } = await encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), body.toString("hex")].join(":");
}

/**
 * Returns null rather than throwing when the ciphertext cannot be read - that
 * happens when APP_SECRET changed, and it should surface as "no key configured"
 * so the operator can simply paste the key again.
 */
export async function decryptSecret(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  const [ivHex, tagHex, bodyHex] = stored.split(":");
  if (!ivHex || !tagHex || !bodyHex) return null;
  try {
    const { key } = await encryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(bodyHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk-...4f2a" - enough to tell two keys apart, not enough to use one. */
export const hintFor = (key: string): string =>
  key.length <= 8 ? "••••" : `${key.slice(0, 3)}…${key.slice(-4)}`;
