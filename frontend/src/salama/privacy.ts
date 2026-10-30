import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Privacy primitives. Three rules live here:
 *  1. A phone number is never stored raw. A keyed HMAC (not a bare hash — the
 *     Tanzanian number space is small enough to brute-force a plain SHA-256)
 *     is used for lookups, and AES-256-GCM ciphertext only when she consents.
 *  2. Anything that could reach a log goes through redact().
 *  3. Secrets are compared in constant time.
 */

export interface Keys {
  hmac: Buffer;
  enc: Buffer;
}

/** Any string works as a secret; we stretch it to 32 bytes with domain separation. */
export function makeKeys(hmacSecret: string, encSecret: string): Keys {
  const d = (label: string, s: string) => createHash("sha256").update(`${label}\0${s}`).digest();
  return { hmac: d("salama-hmac-v1", hmacSecret), enc: d("salama-enc-v1", encSecret) };
}

export function ephemeralKeys(): Keys {
  return makeKeys(randomBytes(32).toString("hex"), randomBytes(32).toString("hex"));
}

/** Normalise Tanzanian-style numbers to E.164. Other countries pass through cleaned. */
export function normalizePhone(raw: string): string {
  const s = String(raw ?? "").replace(/[^\d+]/g, "");
  const digits = s.replace(/\+/g, "");
  if (/^0\d{9}$/.test(digits)) return `+255${digits.slice(1)}`;
  if (/^255\d{9}$/.test(digits)) return `+${digits}`;
  if (/^[67]\d{8}$/.test(digits)) return `+255${digits}`;
  return digits ? `+${digits}` : "";
}

export function hashPhone(phone: string, keys: Keys): string {
  return createHmac("sha256", keys.hmac).update(normalizePhone(phone)).digest("hex");
}

export function encryptPhone(phone: string, keys: Keys): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keys.enc, iv);
  const ct = Buffer.concat([c.update(normalizePhone(phone), "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptPhone(blob: string, keys: Keys): string | null {
  try {
    const [v, iv, tag, ct] = blob.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", keys.enc, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered data: treat as unreadable, never throw into a request
  }
}

const PHONE_LIKE = /\+?\d[\d\s-]{7,}\d/g;
/** Strip anything number-shaped before it can reach a log line. */
export function redact(text: string): string {
  return String(text).replace(PHONE_LIKE, "[number]");
}

/** For operator logs only: "+255712***678". */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  return p.length > 8 ? `${p.slice(0, 7)}***${p.slice(-3)}` : "***";
}

export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L lookalikes
export function randomCode(len = 4): string {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i += 1) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}
