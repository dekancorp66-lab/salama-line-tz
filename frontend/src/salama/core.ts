import { CONTENT, WELLBEING_TIPS } from "./data/content.ts";
import { DISTRICTS } from "./data/districts.ts";
import { SERVICES } from "./data/services.ts";
import { KIND_LABEL, STR } from "./i18n.ts";
import {
  decryptPhone, encryptPhone, hashPhone, normalizePhone, randomCode, type Keys,
} from "./privacy.ts";
import type {
  Case, CaseKind, Channel, ContentItem, District, Lang, Outbound, ServiceEntry,
  ServiceKind, Store, Topic,
} from "./types.ts";

const MIN = 60_000;

export interface Config {
  /** Live mode refuses anything unapproved / unverified. */
  live: boolean;
  hotline: string;
  /** Prefix on SMS to girls. Neutral on purpose so a phone screen reveals little. */
  smsPrefix: string;
  keys: Keys;
  urgentMin: number;
  normalMin: number;
  /** Alerts to district responders before escalating to the focal person. */
  maxRepeats: number;
  /** Open cases older than this have their contact wiped automatically. */
  retentionHours: number;
  /** Aggregates below this are hidden on the dashboard. */
  minCell: number;
  districts: District[];
  content: ContentItem[];
  services: ServiceEntry[];
}

export function defaultConfig(keys: Keys, over: Partial<Config> = {}): Config {
  return {
    live: false, hotline: "116", smsPrefix: "Salama", keys,
    urgentMin: 10, normalMin: 30, maxRepeats: 3, retentionHours: 168, minCell: 5,
    districts: DISTRICTS, content: CONTENT, services: SERVICES, ...over,
  };
}

export interface Deps { store: Store; cfg: Config; now: () => number }

export const SERVICE_ORDER: ServiceKind[] = ["clinic", "legal", "welfare", "counselling"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** The shared rules. USSD, SMS and WhatsApp are thin front-ends over this. */
export class Core {
  d: Deps;
  constructor(d: Deps) { this.d = d; }
  get cfg() { return this.d.cfg; }
  get store() { return this.d.store; }
  hash(phone: string) { return hashPhone(phone, this.cfg.keys); }
  private day() { return new Date(this.d.now()).toISOString().slice(0, 10); }

  // ---------- lookups ----------
  /** Match "Mbeya Jiji", "mbeya", "tukuyu", an id, or a 1-based menu number. */
  findDistrict(input: string): District | null {
    const q = norm(input);
    if (!q) return null;
    const ds = this.cfg.districts;
    if (/^\d+$/.test(q)) return ds[Number(q) - 1] ?? null;
    return ds.find((x) => x.id === q || norm(x.name) === q || x.aliases.includes(q)) ?? null;
  }
  districtName(id: string) { return this.cfg.districts.find((x) => x.id === id)?.name ?? id; }
  districtNames() { return this.cfg.districts.map((x) => x.name); }

  /** Approved text for a topic, or null (live mode + not yet approved). */
  info(topic: Topic, lang: Lang): ContentItem | null {
    const item = this.cfg.content.find((c) => c.topic === topic && c.lang === lang);
    if (!item) return null;
    if (this.cfg.live && item.status !== "approved") return null;
    return item;
  }
  tips(lang: Lang) { return WELLBEING_TIPS[lang]; }

  services(district: string, kind?: ServiceKind): ServiceEntry[] {
    return this.cfg.services.filter(
      (s) => s.district === district && (!kind || s.kind === kind) &&
        (!this.cfg.live || (s.verifiedBy && s.verifiedAt)),
    );
  }
  /** One-line-per-service text, trimmed to fit `max` characters. */
  formatServices(list: ServiceEntry[], lang: Lang, max: number): string[] {
    const t = STR[lang].kindMenuLabel;
    const out: string[] = [];
    let used = 0;
    for (const s of list) {
      const line = `${t[s.kind]}: ${s.name}, ${s.phone}, ${s.hours}`;
      if (used + line.length + 1 > max) break;
      out.push(line);
      used += line.length + 1;
    }
    return out;
  }
  servicesSms(district: string, lang: Lang, kinds?: ServiceKind[]): string {
    const S = STR[lang];
    const list = (kinds ? SERVICE_ORDER.filter((k) => kinds.includes(k)) : SERVICE_ORDER)
      .flatMap((k) => this.services(district, k));
    if (!list.length) return S.servicesPending;
    const lines = this.formatServices(list, lang, 380);
    return `${this.districtName(district)}\n${lines.join("\n")}\n${S.smsFooter}`;
  }

  // ---------- analytics: counts only, never identities ----------
  async track(event: string, channel: Channel, district = "-") {
    await this.store.bump({ day: this.day(), event, district, channel });
  }

  // ---------- consent + cases ----------
  async askConsent(phone: string, kind: CaseKind, district: string) {
    await this.store.setPending({
      key: this.hash(phone), kind, district, expiresAt: this.d.now() + 15 * MIN,
    });
  }
  async takeConsent(phone: string) { return this.store.takePending(this.hash(phone), this.d.now()); }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 20; i += 1) {
      const c = randomCode(4);
      if (!(await this.store.getCaseByCode(c))) return c;
    }
    return randomCode(6);
  }

  /** Create a case and alert responders. `phone` is present only with consent. */
  async openCase(o: {
    kind: CaseKind; district: string; channel: Channel; phone?: string; lang: Lang;
  }): Promise<{ code: string; out: Outbound[] }> {
    const now = this.d.now();
    const anonymous = !o.phone;
    const priority = anonymous || o.kind === "counsellor" ? "normal" : "urgent";
    const code = await this.uniqueCode();
    const c: Case = {
      id: crypto.randomUUID(), code, kind: o.kind, anonymous, priority,
      district: o.district, channel: o.channel, status: "open",
      createdAt: now, lastAlertAt: now, alertCount: 1, escalatedAt: null,
      acceptedAt: null, closedAt: null, responderId: null,
      phoneHash: o.phone ? this.hash(o.phone) : null,
      phoneEnc: o.phone ? encryptPhone(o.phone, this.cfg.keys) : null,
    };
    await this.store.createCase(c);
    await this.track(anonymous ? `report:${o.kind}` : `help:${o.kind}`, o.channel, o.district);

    let out = await this.alert(c, false);
    if (!out.length) {
      // Nobody on duty in this district: go straight to the focal person so a
      // request is never silently dropped.
      out = await this.alert(c, true);
      await this.store.updateCase(code, { escalatedAt: now });
      await this.track("escalated", o.channel, o.district);
    }
    return { code, out };
  }

  private alertText(c: Case, escalation: boolean): string {
    const who = c.anonymous ? "anonymous, no number" : "consented";
    const head = escalation ? "SALAMA ESCALATION" : `SALAMA ${c.priority === "urgent" ? "URGENT" : "NORMAL"}`;
    const n = escalation ? ` | no reply after ${c.alertCount} alerts` : "";
    return `${head} ${c.code} | ${this.districtName(c.district)} | ${KIND_LABEL[c.kind]} | ${who}${n}. Reply ACK ${c.code}`;
  }
  private async alert(c: Case, toFocal: boolean): Promise<Outbound[]> {
    const rs = toFocal
      ? await this.store.listResponders({ role: "focal", activeOnly: true })
      : await this.store.listResponders({ district: c.district, role: "responder", activeOnly: true });
    return rs.map((r) => ({ to: r.phone, via: "sms" as const, text: this.alertText(c, toFocal) }));
  }

  /** Reporter-side: anonymous concern. No phone is ever passed in. */
  async fileReport(kind: CaseKind, district: string, channel: Channel, lang: Lang) {
    return this.openCase({ kind, district, channel, lang });
  }

  // ---------- responder commands ----------
  async ack(responderPhone: string, rawCode: string | undefined): Promise<Outbound[]> {
    const r = await this.store.getResponderByHash(this.hash(responderPhone));
    if (!r) return [];
    const me = (text: string): Outbound[] => [{ to: r.phone, via: "sms", text }];
    let code = (rawCode ?? "").toUpperCase();
    if (!code) {
      // Bare ACK is allowed only when it is unambiguous.
      const open = (await this.store.listCases({ status: "open" }))
        .filter((c) => r.district === "*" || c.district === r.district);
      if (open.length !== 1) return me("Send ACK with the case code, e.g. ACK K7P2.");
      code = open[0].code;
    }
    const c = await this.store.getCaseByCode(code);
    if (!c) return me(`Code ${code} not found.`);
    if (r.district !== "*" && c.district !== r.district) return me(`Case ${code} is outside your district.`);
    if (c.status === "closed" || c.status === "withdrawn") return me(`Case ${code} is already ${c.status}.`);
    if (c.status === "accepted") return me(`Case ${code} was already taken by another responder.`);

    await this.store.updateCase(code, { status: "accepted", acceptedAt: this.d.now(), responderId: r.id });
    await this.track("ack", c.channel, c.district);

    const out: Outbound[] = [];
    const num = c.phoneEnc ? decryptPhone(c.phoneEnc, this.cfg.keys) : null;
    out.push(...me(
      num
        ? `Case ${code}: she agreed to be contacted on ${num}. Confirm it is safe to talk first. Do not contact the family without a safety plan. Reply CLOSE ${code} when done.`
        : `Case ${code}: ${c.anonymous ? "anonymous report, no number held" : "contact unavailable"}. Verify through the community protocol before acting. Reply CLOSE ${code} when done.`,
    ));
    // Tell the rest of the district it is covered, so nobody duplicates work.
    for (const o of await this.alert({ ...c }, false)) {
      if (o.to !== r.phone) out.push({ to: o.to, via: "sms", text: `Case ${code} was taken by another responder.` });
    }
    return out;
  }

  async close(responderPhone: string, rawCode: string | undefined): Promise<Outbound[]> {
    const r = await this.store.getResponderByHash(this.hash(responderPhone));
    if (!r) return [];
    const me = (text: string): Outbound[] => [{ to: r.phone, via: "sms", text }];
    const code = (rawCode ?? "").toUpperCase();
    const c = code ? await this.store.getCaseByCode(code) : null;
    if (!c) return me(code ? `Code ${code} not found.` : "Send CLOSE with the case code, e.g. CLOSE K7P2.");
    if (r.role !== "focal" && c.responderId !== r.id) return me(`Only the responder who accepted case ${code} can close it.`);
    if (c.status === "closed" || c.status === "withdrawn") return me(`Case ${code} is already ${c.status}.`);

    // Courtesy note to the girl BEFORE the number is wiped (neutral wording).
    const out: Outbound[] = [];
    const num = c.phoneEnc ? decryptPhone(c.phoneEnc, this.cfg.keys) : null;
    if (num) out.push({ to: num, via: "sms", text: `${this.cfg.smsPrefix}: ${STR.sw.closedToGirl(code)} / ${STR.en.closedToGirl(code)}` });
    await this.wipe(code, "closed");
    await this.track("close", c.channel, c.district);
    out.push(...me(`Case ${code} closed. Contact details wiped.`));
    return out;
  }

  private async wipe(code: string, status: "closed" | "withdrawn") {
    await this.store.updateCase(code, {
      status, closedAt: this.d.now(), phoneEnc: null, phoneHash: null,
    });
  }

  // ---------- delete my data (FUTA / 99) ----------
  async eraseMe(phone: string, channel: Channel): Promise<{ hadData: boolean; out: Outbound[] }> {
    const touched = await this.store.eraseByPhoneHash(this.hash(phone), this.d.now());
    await this.track("delete", channel);
    const out: Outbound[] = [];
    for (const c of touched) {
      if (c.status !== "accepted" || !c.responderId) continue;
      const r = (await this.store.listResponders()).find((x) => x.id === c.responderId);
      if (r) out.push({ to: r.phone, via: "sms", text: `Case ${c.code} was withdrawn by the user. Her details are deleted. Do not contact her.` });
    }
    return { hadData: touched.length > 0, out };
  }

  // ---------- escalation + retention (run every few minutes) ----------
  async sweep(): Promise<{ out: Outbound[]; escalated: number; wiped: number }> {
    const now = this.d.now();
    const out: Outbound[] = [];
    let escalated = 0;
    let wiped = 0;
    const { urgentMin, normalMin, maxRepeats, retentionHours } = this.cfg;

    for (const c of await this.store.listCases({ status: "open" })) {
      if (now - c.createdAt > retentionHours * 60 * MIN) {
        // Auto-expire: never hold a girl's number indefinitely.
        await this.wipe(c.code, "withdrawn");
        await this.track("expired", c.channel, c.district);
        wiped += 1;
        continue;
      }
      const every = (c.priority === "urgent" ? urgentMin : normalMin) * MIN;
      if (now - c.lastAlertAt < every) continue;

      if (c.escalatedAt === null && c.alertCount < maxRepeats) {
        out.push(...(await this.alert(c, false)));
      } else if (c.escalatedAt === null) {
        out.push(...(await this.alert(c, true)));
        await this.store.updateCase(c.code, { escalatedAt: now });
        await this.track("escalated", c.channel, c.district);
        escalated += 1;
      } else if (c.alertCount < maxRepeats * 2) {
        out.push(...(await this.alert(c, true)));
      } else {
        continue; // reminders exhausted; stays visible in unattended stats
      }
      await this.store.updateCase(c.code, { lastAlertAt: now, alertCount: c.alertCount + 1 });
    }
    await this.store.purgeExpired(now);
    return { out, escalated, wiped };
  }
}
