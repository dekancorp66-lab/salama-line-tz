import { Core, type Config } from "./core.ts";
import { deliver, type Gateways } from "./gateway.ts";
import { handleText } from "./sms.ts";
import { partnerStats } from "./stats.ts";
import { handleUssd } from "./ussd.ts";
import { hashPhone, normalizePhone } from "./privacy.ts";
import type { Channel, Responder, Store } from "./types.ts";

/** One object wiring rules + store + gateways. Routes and tests both use it. */
export function createPlatform(o: { store: Store; cfg: Config; gateways: Gateways; now?: () => number }) {
  const now = o.now ?? (() => Date.now());
  const core = new Core({ store: o.store, cfg: o.cfg, now });
  return {
    core,
    async ussd(req: { sessionId: string; phone: string; text: string }) {
      const r = await handleUssd(core, req);
      await deliver(r.out, o.gateways);
      return r.body;
    },
    async text(req: { from: string; text: string; channel: Channel }) {
      const r = await handleText(core, req);
      await deliver(r.out, o.gateways);
      return r.out;
    },
    async sweep() {
      const r = await core.sweep();
      const d = await deliver(r.out, o.gateways);
      return { escalated: r.escalated, wiped: r.wiped, alertsSent: d.sent, alertsFailed: d.failed };
    },
    stats: () => partnerStats(core),
    async addResponder(r: { id: string; name: string; phone: string; district: string; role: Responder["role"] }) {
      const phone = normalizePhone(r.phone);
      await o.store.addResponder({ ...r, phone, phoneHash: hashPhone(phone, o.cfg.keys), active: true });
    },
  };
}
export type Platform = ReturnType<typeof createPlatform>;
