import { env } from "../lib/env.server.ts";
import { getSql } from "../lib/db.ts";
import { defaultConfig } from "./core.ts";
import { AfricasTalkingGateway, CaptureGateway, ConsoleGateway, WhatsAppGateway, type Gateways } from "./gateway.ts";
import { createPlatform, type Platform } from "./platform.ts";
import { ephemeralKeys, makeKeys, normalizePhone, safeEqual } from "./privacy.ts";
import { MemoryStore } from "./store.memory.ts";
import { PgStore } from "./store.pg.ts";

/**
 * Production wiring from environment variables (see .env.example).
 * Live mode FAILS CLOSED: without real secrets it refuses to start rather than
 * run with throw-away keys, because a restart would make stored contacts unreadable.
 */
const g = globalThis as typeof globalThis & { __salama?: Promise<Platform> };

export const isLive = () => env("SALAMA_LIVE") === "1";

export function getPlatform(): Promise<Platform> {
  g.__salama ??= build().catch((e) => { g.__salama = undefined; throw e; });
  return g.__salama;
}

async function build(): Promise<Platform> {
  const live = isLive();
  const hmac = env("SALAMA_HMAC_KEY");
  const enc = env("SALAMA_ENC_KEY");
  if (live && (!hmac || !enc)) throw new Error("SALAMA_LIVE=1 requires SALAMA_HMAC_KEY and SALAMA_ENC_KEY");
  if (live && (hmac!.length < 32 || enc!.length < 32)) throw new Error("SALAMA_HMAC_KEY and SALAMA_ENC_KEY must be at least 32 characters");
  const keys = hmac && enc ? makeKeys(hmac, enc) : ephemeralKeys();

  const sms = env("AT_API_KEY") && env("AT_USERNAME")
    ? new AfricasTalkingGateway({ apiKey: env("AT_API_KEY")!, username: env("AT_USERNAME")!, from: env("AT_SENDER_ID") })
    : new ConsoleGateway();
  const gateways: Gateways = { sms };
  if (env("WA_TOKEN") && env("WA_PHONE_ID")) gateways.whatsapp = new WhatsAppGateway({ token: env("WA_TOKEN")!, phoneId: env("WA_PHONE_ID")!, version: env("WA_API_VERSION") });
  if (live && sms instanceof ConsoleGateway) throw new Error("SALAMA_LIVE=1 requires AT_API_KEY and AT_USERNAME (an SMS gateway)");

  const cfg = defaultConfig(keys, {
    live,
    hotline: env("SALAMA_HELPLINE") ?? "116",
    smsPrefix: env("SALAMA_SMS_PREFIX") ?? "Salama",
  });
  return createPlatform({ store: new PgStore(await getSql()), cfg, gateways });
}

// ---------- shared bearer / key checks ----------
/** Constant-time check of "Authorization: Bearer x" or "?key=x" against a secret. */
export function authorized(request: Request, secret: string | undefined, o: { allowUnsetInDemo?: boolean } = {}): boolean {
  if (!secret) return !isLive() && o.allowUnsetInDemo !== false; // unset secret: fine in demo, closed in live
  const h = request.headers.get("authorization") ?? "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : new URL(request.url).searchParams.get("key") ?? "";
  return !!given && safeEqual(given, secret);
}

export async function readParams(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = (await request.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
    }
    return Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return {};
  }
}

// ---------- isolated demo sandbox for the website simulator ----------
// Memory-only, captured messages, fake clock, fake numbers. It can NEVER send a
// real SMS or touch the production database, so visitors can safely play.
export const DEMO = { girl: "+255700000001", responder: "+255700000002", focal: "+255700000003" } as const;
interface Sim { p: Platform; gw: CaptureGateway; clock: { t: number }; cursor: number; last: number; n: number }
const sims = ((globalThis as any).__salamaSims ??= new Map<string, Sim>()) as Map<string, Sim>;

export async function getSim(id: string): Promise<Sim> {
  const key = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "anon";
  const now = Date.now();
  for (const [k, s] of sims) if (now - s.last > 30 * 60_000) sims.delete(k);
  let s = sims.get(key);
  if (!s) {
    if (sims.size >= 200) sims.delete(sims.keys().next().value as string);
    const gw = new CaptureGateway();
    const clock = { t: now };
    const p = createPlatform({ store: new MemoryStore(), cfg: defaultConfig(ephemeralKeys()), gateways: { sms: gw, whatsapp: gw }, now: () => clock.t });
    await p.addResponder({ id: "demo-r", name: "Demo responder", phone: DEMO.responder, district: "mbeya-city", role: "responder" });
    await p.addResponder({ id: "demo-f", name: "Demo focal person", phone: DEMO.focal, district: "*", role: "focal" });
    s = { p, gw, clock, cursor: 0, last: now, n: 0 };
    sims.set(key, s);
  }
  s.last = now;
  return s;
}

/** Messages produced since the last call, bucketed by who they were sent to. */
export function drain(s: Sim) {
  const fresh = s.gw.sent.slice(s.cursor);
  s.cursor = s.gw.sent.length;
  const by = { girl: [] as string[], responder: [] as string[], focal: [] as string[] };
  for (const m of fresh) {
    const to = normalizePhone(m.to);
    if (to === DEMO.girl) by.girl.push(m.text);
    else if (to === DEMO.responder) by.responder.push(m.text);
    else if (to === DEMO.focal) by.focal.push(m.text);
  }
  return by;
}
