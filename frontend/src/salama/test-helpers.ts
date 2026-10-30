import { defaultConfig, type Config } from "./core.ts";
import { CaptureGateway } from "./gateway.ts";
import { createPlatform } from "./platform.ts";
import { makeKeys, normalizePhone } from "./privacy.ts";
import { MemoryStore } from "./store.memory.ts";
import type { Store } from "./types.ts";

export const GIRL = "+255712345678";
export const R1 = "+255754000001";
export const R2 = "+255754000002";
export const FOCAL = "+255754000009";

/** A full platform on a fake clock, with every outgoing message captured. */
export async function rig(o: { live?: boolean; store?: Store; cfg?: Partial<Config>; seed?: boolean } = {}) {
  const clock = { t: Date.UTC(2026, 9, 22, 8, 0, 0) };
  const sms = new CaptureGateway();
  const wa = new CaptureGateway();
  const store = o.store ?? new MemoryStore();
  const keys = makeKeys("test-hmac", "test-enc");
  const cfg = defaultConfig(keys, { live: !!o.live, ...o.cfg });
  const p = createPlatform({ store, cfg, gateways: { sms, whatsapp: wa }, now: () => clock.t });
  if (o.seed !== false) {
    await p.addResponder({ id: "r1", name: "Responder One", phone: R1, district: "mbeya-city", role: "responder" });
    await p.addResponder({ id: "r2", name: "Responder Two", phone: R2, district: "mbeya-city", role: "responder" });
    await p.addResponder({ id: "f1", name: "Focal", phone: FOCAL, district: "*", role: "focal" });
  }
  return {
    p, store, sms, wa, keys, clock,
    advance: (min: number) => { clock.t += min * 60_000; },
    inbox: (to: string) => sms.sent.filter((m) => normalizePhone(m.to) === normalizePhone(to)).map((m) => m.text),
    ussd: (text: string, session = "s1", phone = GIRL) => p.ussd({ sessionId: session, phone, text }),
    text: (from: string, text: string, channel: "sms" | "whatsapp" = "sms") => p.text({ from, text, channel }),
  };
}
export type Rig = Awaited<ReturnType<typeof rig>>;
export const codeOf = (s: string) => /\b([A-Z2-9]{4})\b/.exec(s.replace(/SALAMA|URGENT|NORMAL|ACK|CLOSE/g, ""))?.[1] ?? "";
