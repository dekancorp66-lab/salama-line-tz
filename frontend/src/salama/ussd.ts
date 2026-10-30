import { Core, SERVICE_ORDER } from "./core.ts";
import { STR, type Strings } from "./i18n.ts";
import type { CaseKind, Lang, Outbound, ServiceKind, Topic } from "./types.ts";

/**
 * USSD menu machine. Africa's Talking (and most aggregators) send the WHOLE
 * path so far as "1*3*2", so we keep no session state at all: we replay the
 * path through the menu tree on every request. Side effects (opening a case,
 * sending an SMS) fire only for the LAST input, and are guarded so a retried
 * request cannot open two cases.
 *   0 = back, 00 = quick exit (neutral goodbye), 99 = delete my data.
 */
type Frame = { n: string; d?: any };
type Final = { run: () => Promise<{ text: string; out: Outbound[] }>; dup: string };
type Step =
  | { kind: "push"; frame: Frame }
  | { kind: "pop" }
  | { kind: "lang"; lang: Lang }
  | { kind: "final"; final: Final }
  | { kind: "invalid" };

const TOPICS: Topic[] = ["marriage", "fgm", "online", "health"];
const HELP_KINDS: CaseKind[] = ["marriage", "fgm", "violence"];

function pick(raw: string, n: number): number | null {
  const v = Number(raw);
  return /^\d+$/.test(raw) && v >= 1 && v <= n ? v : null;
}

export async function handleUssd(
  core: Core,
  req: { sessionId: string; phone: string; text: string },
): Promise<{ body: string; out: Outbound[] }> {
  const inputs = req.text === "" ? [] : req.text.split("*").map((s) => s.trim());
  let lang: Lang = "sw";
  const stack: Frame[] = [{ n: "lang" }];
  const S = () => STR[lang];
  const sms = (text: string): Outbound => ({
    to: req.phone, via: "sms", text: `${core.cfg.smsPrefix}: ${text}`,
  });
  let invalidLast = false;

  const render = (f: Frame): string => {
    const s: Strings = S();
    switch (f.n) {
      case "lang": return s.langMenu;
      case "main": return s.main;
      case "info": return s.infoMenu;
      case "infoTopic": {
        const it = core.info(f.d.topic, lang);
        return it ? s.infoAfter(it.short) : `${s.contentPending}\n0`;
      }
      case "svcDistrict": return s.districtMenu(lang === "sw" ? "Chagua wilaya:" : "Choose district:", core.districtNames());
      case "svcKind": return s.svcKindMenu;
      case "svcList": {
        const list = core.services(f.d.district, f.d.kind);
        if (!list.length) return `${s.servicesPending}\n0`;
        return s.svcList(core.formatServices(list, lang, 110));
      }
      case "help": return s.helpMenu;
      case "district": return s.districtMenu(lang === "sw" ? "Uko wilaya gani?" : "Which district are you in?", core.districtNames());
      case "consent": return s.consent(core.districtName(f.d.district));
      case "report": return s.reportMenu;
      case "reportConfirm": return s.reportConfirm;
      case "wellbeing": return s.wellbeingMenu;
      case "wellbeingLow": return s.wellbeingLow;
      case "delete": return s.deleteConfirm;
      default: return s.main;
    }
  };

  const onInput = (f: Frame, raw: string): Step => {
    const s = S();
    const push = (n: string, d?: any): Step => ({ kind: "push", frame: { n, d } });
    const fin = (run: Final["run"], dup: string): Step => ({ kind: "final", final: { run, dup } });
    const track = (e: string, d = "-") => core.track(e, "ussd", d);
    let v: number | null;
    switch (f.n) {
      case "lang":
        return raw === "1" ? { kind: "lang", lang: "sw" } : raw === "2" ? { kind: "lang", lang: "en" } : { kind: "invalid" };
      case "main":
        v = pick(raw, 5);
        if (!v) return { kind: "invalid" };
        return [push("info"), push("svcDistrict", { purpose: "services" }), push("help"), push("report"), push("wellbeing")][v - 1];
      case "info":
        v = pick(raw, 4);
        return v ? push("infoTopic", { topic: TOPICS[v - 1] }) : { kind: "invalid" };
      case "infoTopic": {
        const it = core.info(f.d.topic, lang);
        if (raw !== "1" || !it) return { kind: "invalid" };
        return fin(async () => {
          await track(`info:${f.d.topic}`);
          return { text: s.sentSms, out: [sms(it.full)] };
        }, s.sentSms);
      }
      case "svcDistrict": {
        v = pick(raw, core.cfg.districts.length);
        if (!v) return { kind: "invalid" };
        const district = core.cfg.districts[v - 1].id;
        return f.d.purpose === "care" ? push("svcList", { district, kind: "clinic", care: true }) : push("svcKind", { district });
      }
      case "svcKind": {
        v = pick(raw, 5);
        if (!v) return { kind: "invalid" };
        if (v === 5) {
          return fin(async () => {
            await track("services", f.d.district);
            return { text: s.sentSms, out: [sms(core.servicesSms(f.d.district, lang))] };
          }, s.sentSms);
        }
        return push("svcList", { district: f.d.district, kind: SERVICE_ORDER[v - 1] as ServiceKind });
      }
      case "svcList":
        if (raw !== "1") return { kind: "invalid" };
        return fin(async () => {
          await track(f.d.care ? "care" : "services", f.d.district);
          const kinds: ServiceKind[] = f.d.care ? ["clinic", "counselling"] : [f.d.kind];
          return { text: s.sentSms, out: [sms(core.servicesSms(f.d.district, lang, kinds))] };
        }, s.sentSms);
      case "help":
        v = pick(raw, 4);
        if (!v) return { kind: "invalid" };
        return v === 4 ? push("svcDistrict", { purpose: "care" }) : push("district", { purpose: "help", kind: HELP_KINDS[v - 1] });
      case "district": {
        v = pick(raw, core.cfg.districts.length);
        if (!v) return { kind: "invalid" };
        const district = core.cfg.districts[v - 1].id;
        const { purpose, kind } = f.d;
        if (purpose === "report") return push("reportConfirm", { kind, district });
        return push("consent", { kind: purpose === "counsel" ? "counsellor" : kind, district });
      }
      case "consent":
        if (raw === "1") {
          return fin(async () => {
            const r = await core.openCase({ kind: f.d.kind, district: f.d.district, channel: "ussd", phone: req.phone, lang });
            return { text: s.helpDone(r.code), out: [sms(s.helpDoneSms(r.code)), ...r.out] };
          }, s.helpDone(lang === "sw" ? "(angalia SMS)" : "(see SMS)"));
        }
        if (raw === "2") {
          return fin(async () => {
            await track("consent_declined", f.d.district);
            return { text: s.helpDeclined, out: [sms(core.servicesSms(f.d.district, lang))] };
          }, s.helpDeclined);
        }
        return { kind: "invalid" };
      case "report":
        v = pick(raw, 3);
        return v ? push("district", { purpose: "report", kind: HELP_KINDS[v - 1] }) : { kind: "invalid" };
      case "reportConfirm":
        if (raw !== "1") return { kind: "invalid" };
        return fin(async () => {
          // No phone number is passed in: an anonymous report holds none.
          const r = await core.fileReport(f.d.kind, f.d.district, "ussd", lang);
          return { text: s.reportDone, out: r.out };
        }, s.reportDone);
      case "wellbeing":
        v = pick(raw, 4);
        if (!v) return { kind: "invalid" };
        if (v >= 3) return { kind: "push", frame: { n: "wellbeingLow" } };
        return fin(async () => {
          await track("wellbeing:ok");
          return { text: core.tips(lang), out: [] };
        }, core.tips(lang));
      case "wellbeingLow":
        if (raw === "1") return push("district", { purpose: "counsel" });
        if (raw === "2") return fin(async () => { await track("wellbeing:low"); return { text: s.wellbeingNo, out: [] }; }, s.wellbeingNo);
        return { kind: "invalid" };
      case "delete":
        if (raw === "2") return { kind: "pop" };
        if (raw !== "1") return { kind: "invalid" };
        return fin(async () => {
          const r = await core.eraseMe(req.phone, "ussd");
          return { text: r.hadData ? s.deleted : s.deleteNone, out: r.out };
        }, s.deleted);
      default:
        return { kind: "invalid" };
    }
  };

  for (let i = 0; i < inputs.length; i += 1) {
    const raw = inputs[i];
    const isLast = i === inputs.length - 1;
    invalidLast = false;
    if (raw === "00") return { body: `END ${S().exit}`, out: [] }; // quick exit, nothing sent
    if (raw === "99") {
      if (stack[stack.length - 1].n !== "delete") stack.push({ n: "delete" });
      continue;
    }
    if (raw === "0") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const step = onInput(stack[stack.length - 1], raw);
    if (step.kind === "invalid") { invalidLast = isLast; continue; }
    if (step.kind === "lang") { lang = step.lang; stack.splice(0, stack.length, { n: "main" }); continue; }
    if (step.kind === "push") { stack.push(step.frame); continue; }
    if (step.kind === "pop") { stack.pop(); continue; }
    // Terminal step. Only the newest input may cause side effects.
    if (!isLast) return { body: `END ${step.final.dup}`, out: [] };
    const first = await core.store.claimOnce(`ussd:${req.sessionId}:${req.text}`, core.d.now(), 10 * 60_000);
    if (!first) return { body: `END ${step.final.dup}`, out: [] };
    const r = await step.final.run();
    return { body: `END ${r.text}`, out: r.out };
  }

  const screen = render(stack[stack.length - 1]);
  return { body: `CON ${invalidLast ? S().invalid : ""}${screen}`, out: [] };
}
