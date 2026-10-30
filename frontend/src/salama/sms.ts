import { Core } from "./core.ts";
import { STR } from "./i18n.ts";
import type { CaseKind, Channel, Lang, Outbound, ServiceKind, Topic } from "./types.ts";

/**
 * SMS + WhatsApp command router. Both channels speak the same plain-text
 * commands, so this one function serves both. It is stateless apart from the
 * 15-minute consent prompt that a "help" command creates.
 */
const SW = new Set(["SALAMA", "KLINIKI", "MSAADA", "RIPOTI", "USTAWI", "FUTA", "HUDUMA", "HABARI", "NDIO", "HAPANA", "TOKA", "USHAURI", "SHERIA", "FUNGA", "FGM"]);
const CMD: Record<string, string> = {
  SALAMA: "menu", MENU: "menu",
  KLINIKI: "clinic", CLINIC: "clinic",
  SHERIA: "legal", LEGAL: "legal",
  HUDUMA: "services", SERVICES: "services",
  MSAADA: "help", HELP: "help",
  FGM: "fgm",
  USHAURI: "counsel", COUNSELLOR: "counsel", COUNSELOR: "counsel",
  RIPOTI: "report", REPORT: "report",
  USTAWI: "wellbeing", WELLBEING: "wellbeing",
  HABARI: "info", INFO: "info",
  NDIO: "yes", YES: "yes", HAPANA: "no", NO: "no",
  FUTA: "delete", DELETE: "delete",
  TOKA: "exit", EXIT: "exit", "00": "exit",
  ACK: "ack", CLOSE: "close", FUNGA: "close",
};
const KIND_WORDS: Record<string, CaseKind> = {
  NDOA: "marriage", MARRIAGE: "marriage", FGM: "fgm", UKEKETAJI: "fgm",
  UKATILI: "violence", VIOLENCE: "violence",
};
const TOPIC_WORDS: Record<string, Topic> = {
  NDOA: "marriage", MARRIAGE: "marriage", FGM: "fgm", UKEKETAJI: "fgm",
  MTANDAO: "online", ONLINE: "online", AFYA: "health", HEALTH: "health",
};

export async function handleText(
  core: Core,
  req: { from: string; text: string; channel: Channel },
): Promise<{ out: Outbound[] }> {
  const tokens = String(req.text ?? "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const word = tokens[0] ?? "";
  const action = CMD[word] ?? "unknown";
  const rest = tokens.slice(1);
  const lang: Lang = SW.has(word) || !CMD[word] ? "sw" : "en";
  const S = STR[lang];
  const via = req.channel === "whatsapp" ? "whatsapp" : "sms";
  const reply = (text: string, ...more: Outbound[]): { out: Outbound[] } => ({
    out: [{ to: req.from, via, text: `${core.cfg.smsPrefix}: ${text}` }, ...more],
  });

  // Staff first: a registered responder's messages are protocol commands only.
  const staff = await core.store.getResponderByHash(core.hash(req.from));
  if (staff) {
    const code = rest[0];
    if (action === "ack") return { out: await core.ack(req.from, code) };
    if (action === "close") return { out: await core.close(req.from, code) };
    return { out: [{ to: req.from, via: "sms", text: "SalamaLine responder: ACK <code> to accept, CLOSE <code> when done." }] };
  }

  // Longest-prefix district match: "MBEYA VIJIJINI NDOA" -> Mbeya Vijijini + [NDOA]
  const parseDistrict = () => {
    for (let n = rest.length; n >= 1; n -= 1) {
      const d = core.findDistrict(rest.slice(0, n).join(" "));
      if (d) return { district: d, extra: rest.slice(n) };
    }
    return null;
  };
  const needDistrict = () => reply(S.needDistrict(word, core.districtNames()));

  switch (action) {
    case "menu":
    case "unknown":
      return reply(S.smsMenu);

    case "clinic":
    case "legal":
    case "services": {
      const p = parseDistrict();
      if (!p) return needDistrict();
      await core.track("services", req.channel, p.district.id);
      const kinds: ServiceKind[] | undefined =
        action === "clinic" ? ["clinic", "counselling"] : action === "legal" ? ["legal", "welfare"] : undefined;
      return reply(core.servicesSms(p.district.id, lang, kinds));
    }

    case "help":
    case "fgm":
    case "counsel": {
      const p = parseDistrict();
      if (!p) return needDistrict();
      const kind: CaseKind =
        action === "fgm" ? "fgm" : action === "counsel" ? "counsellor" : (KIND_WORDS[p.extra[0]] ?? "general");
      // Consent first: nobody is alerted until she replies YES.
      await core.askConsent(req.from, kind, p.district.id);
      return reply(S.consentSms(p.district.name));
    }

    case "yes": {
      const pend = await core.takeConsent(req.from);
      if (!pend) return reply(S.noneToConfirm);
      const r = await core.openCase({ kind: pend.kind, district: pend.district, channel: req.channel, phone: req.from, lang });
      return reply(S.helpDoneSms(r.code), ...r.out);
    }
    case "no": {
      const pend = await core.takeConsent(req.from);
      if (pend) await core.track("consent_declined", req.channel, pend.district);
      return reply(pend ? S.declinedSms : S.noneToConfirm);
    }

    case "report": {
      const p = parseDistrict();
      if (!p) return needDistrict();
      // Anonymous by construction: req.from is never passed on or stored.
      const r = await core.fileReport(KIND_WORDS[p.extra[0]] ?? "general", p.district.id, req.channel, lang);
      return { out: [{ to: req.from, via, text: `${core.cfg.smsPrefix}: ${S.reportDoneSms}` }, ...r.out] };
    }

    case "wellbeing": {
      const n = Number(rest[0]);
      if (!(n >= 1 && n <= 4)) return reply(S.wellbeingPrompt);
      await core.track(n <= 2 ? "wellbeing:ok" : "wellbeing:low", req.channel);
      return reply(n <= 2 ? core.tips(lang) : S.wellbeingLowSms);
    }

    case "info": {
      const topic = TOPIC_WORDS[rest[0]];
      if (!topic) return reply(lang === "sw" ? "Tuma HABARI NDOA, HABARI FGM, HABARI MTANDAO au HABARI AFYA." : "Send INFO MARRIAGE, INFO FGM, INFO ONLINE or INFO HEALTH.");
      const it = core.info(topic, lang);
      await core.track(`info:${topic}`, req.channel);
      return reply(it ? it.full : S.contentPending);
    }

    case "delete": {
      const r = await core.eraseMe(req.from, req.channel);
      return reply(r.hadData ? S.deleted : S.deleteNone, ...r.out);
    }

    case "exit": {
      await core.takeConsent(req.from); // drop any waiting consent prompt
      return reply(S.exit);
    }

    default:
      return reply(S.smsMenu);
  }
}
