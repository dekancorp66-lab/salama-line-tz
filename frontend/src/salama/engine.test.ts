import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decryptPhone, encryptPhone, hashPhone, makeKeys, normalizePhone, redact, safeEqual, randomCode } from "./privacy.ts";
import { suppress } from "./stats.ts";
import { ConsoleGateway } from "./gateway.ts";
import { STR } from "./i18n.ts";
import { CONTENT } from "./data/content.ts";
import { FOCAL, GIRL, R1, R2, rig } from "./test-helpers.ts";

const dump = (r: Awaited<ReturnType<typeof rig>>) =>
  JSON.stringify([...(r.store as any).cases.values(), ...(r.store as any).pending.values(), ...(r.store as any).counts.values(), ...(r.store as any).once.keys()]);

describe("privacy primitives", () => {
  const k = makeKeys("a", "b");
  it("normalises Tanzanian numbers to E.164", () => {
    for (const x of ["0712345678", "255712345678", "+255 712 345 678", "712345678"]) assert.equal(normalizePhone(x), "+255712345678");
  });
  it("hashes are keyed: same number + different key = different hash", () => {
    assert.equal(hashPhone("0712345678", k), hashPhone("+255712345678", k));
    assert.notEqual(hashPhone(GIRL, k), hashPhone(GIRL, makeKeys("x", "y")));
  });
  it("encrypts round-trip, differs every time, and fails closed on a wrong key", () => {
    const a = encryptPhone(GIRL, k), b = encryptPhone(GIRL, k);
    assert.notEqual(a, b);
    assert.equal(decryptPhone(a, k), GIRL);
    assert.equal(decryptPhone(a, makeKeys("a", "other")), null);
    assert.equal(decryptPhone(a.slice(0, -4) + "AAAA", k), null);
  });
  it("redacts number-shaped text and compares secrets safely", () => {
    assert.equal(redact("call +255 712 345 678 now"), "call [number] now");
    assert.ok(safeEqual("abc", "abc") && !safeEqual("abc", "abd"));
    assert.match(randomCode(4), /^[A-HJKMNP-Z2-9]{4}$/);
  });
});

describe("approved content only", () => {
  it("every string is plain ASCII and every SMS fits 3 segments", () => {
    const all = [...CONTENT.flatMap((c) => [c.short, c.full]), ...Object.values(STR.sw).filter((v) => typeof v === "string"), ...Object.values(STR.en).filter((v) => typeof v === "string")] as string[];
    for (const s of all) assert.ok(/^[\x20-\x7E\n]*$/.test(s), `non-ASCII in: ${s}`);
    for (const c of CONTENT) { assert.ok(c.full.length <= 450, c.id); assert.ok(c.short.length <= 110, c.id); }
  });
  it("live mode serves NOTHING unapproved (info and services)", async () => {
    const r = await rig({ live: true });
    assert.match(await r.ussd("1*1*1"), /^CON .*bado inakaguliwa/s);
    const out = await r.text(GIRL, "HABARI NDOA");
    assert.match(out[0].text, /bado inakaguliwa/);
    const s = await r.text(GIRL, "KLINIKI mbeya");
    assert.match(s[0].text, /bado inakaguliwa/);
  });
  it("demo mode serves placeholders but labels sample services", async () => {
    const r = await rig();
    assert.match((await r.text(GIRL, "KLINIKI mbeya"))[0].text, /\[SAMPLE\]/);
  });
});

describe("USSD", () => {
  it("walks language -> menu -> info and sends the full text by SMS", async () => {
    const r = await rig();
    assert.match(await r.ussd(""), /^CON SalamaLine\n1\. Kiswahili/);
    assert.match(await r.ussd("2"), /^CON SalamaLine\n1\. Information/);
    assert.match(await r.ussd("2*1*1"), /^CON Child marriage can harm/);
    assert.match(await r.ussd("2*1*1*1"), /^END Sent by SMS\./);
    assert.match(r.inbox(GIRL)[0], /^Salama: Child marriage can harm your health, schooling/);
  });
  it("0 goes back, 00 quick-exits with a neutral goodbye and sends nothing", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*1*0"), /^CON SalamaLine\n1\. Information/);
    assert.equal(await r.ussd("2*3*00"), "END Thank you.");
    assert.equal(r.sms.sent.length, 0);
  });
  it("invalid input re-shows the screen with a notice", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*9"), /^CON Invalid choice\.\nSalamaLine/);
  });
  it("help + consent opens a case, alerts the district, never leaks her number", async () => {
    const r = await rig();
    const body = await r.ussd("2*3*1*1*1");
    const code = /Code: ([A-Z2-9]{4})/.exec(body)![1];
    assert.match(body, /^END Request received/);
    assert.match(r.inbox(GIRL)[0], new RegExp(`^Salama: Your request was received\\. Code ${code}`));
    for (const staff of [R1, R2]) {
      const a = r.inbox(staff)[0];
      assert.match(a, new RegExp(`SALAMA URGENT ${code} \\| Mbeya Jiji \\| forced marriage`));
      assert.ok(!a.includes("712345678"), "alert must not contain her number");
    }
    const [c] = await r.store.listCases();
    assert.ok(c.phoneEnc && c.phoneHash && !c.anonymous && c.priority === "urgent");
    assert.ok(!dump(r).includes("712345678"), "no raw number anywhere in the store");
  });
  it("declining consent alerts nobody but still gives services", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*3*2*1*2"), /^END OK\. Nobody was alerted/);
    assert.equal((await r.store.listCases()).length, 0);
    assert.equal(r.inbox(R1).length, 0);
    assert.match(r.inbox(GIRL)[0], /\[SAMPLE\]/);
  });
  it("a retried request cannot open two cases", async () => {
    const r = await rig();
    await r.ussd("2*3*1*1*1", "dup");
    const again = await r.ussd("2*3*1*1*1", "dup");
    assert.match(again, /^END Request received/);
    assert.equal((await r.store.listCases()).length, 1);
    assert.equal(r.inbox(R1).length, 1);
  });
  it("anonymous report stores no number at all", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*4*1*1*1"), /^END Report received/);
    const [c] = await r.store.listCases();
    assert.ok(c.anonymous && c.phoneHash === null && c.phoneEnc === null && c.priority === "normal");
    assert.match(r.inbox(R1)[0], /anonymous, no number/);
    assert.equal(r.inbox(GIRL).length, 0);
  });
  it("'I was cut, I need care' shows services and raises NO alert", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*3*4*1*1"), /^END Sent by SMS/);
    assert.equal((await r.store.listCases()).length, 0);
    assert.equal(r.inbox(R1).length, 0);
  });
  it("low wellbeing shows the helpline first, then offers a counsellor with consent", async () => {
    const r = await rig();
    assert.match(await r.ussd("2*5*4"), /call 116/);
    assert.match(await r.ussd("2*5*4*1*1"), /^CON A trained person in Mbeya Jiji/);
    await r.ussd("2*5*4*1*1*1");
    const [c] = await r.store.listCases();
    assert.equal(c.kind, "counsellor");
    // Nothing she answered is stored: only anonymous counters.
    assert.ok(!dump(r).includes("wellbeing\":4"));
  });
  it("99 deletes everything and withdraws an open case", async () => {
    const r = await rig();
    await r.ussd("2*3*1*1*1", "a");
    assert.match(await r.ussd("2*99", "b"), /^CON Delete all your data/);
    assert.match(await r.ussd("2*99*1", "c"), /^END Deleted/);
    const [c] = await r.store.listCases();
    assert.equal(c.status, "withdrawn");
    assert.ok(c.phoneEnc === null && c.phoneHash === null);
  });
  it("every reachable screen fits a USSD screen (182 chars) in both languages", async () => {
    const r = await rig();
    let n = 0;
    const crawl = async (path: string, depth: number) => {
      const body = await r.ussd(path, `crawl-${n++}`);
      assert.ok(body.length <= 186, `too long (${body.length}) at "${path}": ${body}`);
      if (!body.startsWith("CON") || depth > 6) return;
      for (const k of ["1", "2", "3", "4", "5", "6", "7"]) await crawl(path ? `${path}*${k}` : k, depth + 1);
    };
    await crawl("", 0);
  });
});

describe("SMS / WhatsApp", () => {
  it("MSAADA asks consent first; nobody is alerted until she says NDIO", async () => {
    const r = await rig();
    const o1 = await r.text(GIRL, "msaada  Mbeya Jiji");
    assert.match(o1[0].text, /Jibu NDIO kukubali/);
    assert.equal(r.inbox(R1).length, 0);
    const o2 = await r.text(GIRL, "NDIO");
    assert.match(o2[0].text, /Msimbo [A-Z2-9]{4}/);
    assert.equal(r.inbox(R1).length, 1);
    assert.match((await r.text(GIRL, "NDIO"))[0].text, /Hakuna ombi/);
  });
  it("HAPANA cancels; an expired prompt does nothing", async () => {
    const r = await rig();
    await r.text(GIRL, "MSAADA mbeya");
    assert.match((await r.text(GIRL, "HAPANA"))[0].text, /Hakuna aliyearifiwa/);
    await r.text(GIRL, "MSAADA mbeya");
    r.advance(16);
    assert.match((await r.text(GIRL, "NDIO"))[0].text, /Hakuna ombi/);
    assert.equal((await r.store.listCases()).length, 0);
  });
  it("FGM <district> is an urgent consented request", async () => {
    const r = await rig();
    await r.text(GIRL, "FGM Mbeya");
    await r.text(GIRL, "NDIO");
    const [c] = await r.store.listCases();
    assert.equal(c.kind, "fgm"); assert.equal(c.priority, "urgent");
  });
  it("RIPOTI is anonymous: the sender's number is not stored or forwarded", async () => {
    const r = await rig();
    await r.text("+255700111222", "RIPOTI mbeya vijijini NDOA");
    const [c] = await r.store.listCases();
    assert.equal(c.district, "mbeya-rural"); assert.equal(c.kind, "marriage"); assert.ok(c.anonymous && !c.phoneHash);
    assert.ok(!dump(r).includes("700111222"));
    assert.ok(!r.sms.sent.some((m) => m.to !== "+255700111222" && m.text.includes("700111222")));
  });
  it("English commands get English replies; WhatsApp replies go via WhatsApp", async () => {
    const r = await rig();
    const out = await r.text(GIRL, "HELP Mbeya", "whatsapp");
    assert.match(out[0].text, /Reply YES to agree/);
    assert.equal(r.wa.sent.length, 1); assert.equal(r.sms.sent.length, 0);
  });
  it("missing district gets a helpful prompt; unknown text gets the menu", async () => {
    const r = await rig();
    assert.match((await r.text(GIRL, "KLINIKI"))[0].text, /Wilaya: Mbeya Jiji/);
    assert.match((await r.text(GIRL, "hello?"))[0].text, /Msaada wa bure: 116/);
  });
  it("USTAWI scores nothing: only anonymous counters change", async () => {
    const r = await rig();
    assert.match((await r.text(GIRL, "USTAWI 4"))[0].text, /piga 116/);
    assert.match((await r.text(GIRL, "USTAWI 1"))[0].text, /Ni vizuri/);
    assert.equal((await r.store.listCases()).length, 0);
  });
  it("FUTA erases pending consent and withdraws open cases", async () => {
    const r = await rig();
    await r.text(GIRL, "MSAADA mbeya"); await r.text(GIRL, "NDIO");
    const [open] = await r.store.listCases();
    await r.text(GIRL, "ACK-ignored");
    assert.match((await r.text(GIRL, "FUTA"))[0].text, /Imefutwa/);
    const [c] = await r.store.listCases();
    assert.equal(c.status, "withdrawn"); assert.ok(!c.phoneEnc && !c.phoneHash);
    assert.equal(open.status, "open");
    assert.match((await r.text(GIRL, "FUTA"))[0].text, /Hatuna data/);
  });
});

describe("responders: ACK, CLOSE and the wipe", () => {
  async function opened() {
    const r = await rig();
    await r.text(GIRL, "MSAADA mbeya NDOA"); await r.text(GIRL, "NDIO");
    const code = (await r.store.listCases())[0].code;
    return { r, code };
  }
  it("number is revealed only on ACK, and the rest of the district is told it is taken", async () => {
    const { r, code } = await opened();
    assert.ok(!r.inbox(R1)[0].includes("712345678"));
    await r.text(R1, `ack ${code}`);
    assert.match(r.inbox(R1).at(-1)!, /agreed to be contacted on \+255712345678.*safety plan/);
    assert.match(r.inbox(R2).at(-1)!, /taken by another responder/);
    await r.text(R2, `ACK ${code}`);
    assert.match(r.inbox(R2).at(-1)!, /already taken/);
  });
  it("only the accepting responder (or focal) can close; closing wipes her number", async () => {
    const { r, code } = await opened();
    await r.text(R1, `ACK ${code}`);
    await r.text(R2, `CLOSE ${code}`);
    assert.match(r.inbox(R2).at(-1)!, /Only the responder who accepted/);
    await r.text(R1, `CLOSE ${code}`);
    const c = (await r.store.getCaseByCode(code))!;
    assert.equal(c.status, "closed"); assert.ok(c.phoneEnc === null && c.phoneHash === null);
    assert.match(r.inbox(GIRL).at(-1)!, /imefungwa na namba yako imefutwa/);
    assert.ok(!dump(r).includes("712345678"));
  });
  it("a bare ACK works when exactly one case is open; strangers cannot ACK", async () => {
    const { r, code } = await opened();
    await r.text("+255799000000", `ACK ${code}`);
    assert.equal((await r.store.getCaseByCode(code))!.status, "open");
    await r.text(R1, "ACK");
    assert.equal((await r.store.getCaseByCode(code))!.status, "accepted");
  });
  it("a responder from another district cannot take the case", async () => {
    const { r, code } = await opened();
    await r.p.addResponder({ id: "r9", name: "Kyela", phone: "+255754000077", district: "kyela", role: "responder" });
    await r.text("+255754000077", `ACK ${code}`);
    assert.match(r.inbox("+255754000077").at(-1)!, /outside your district/);
  });
  it("FUTA after ACK tells the responder not to contact her", async () => {
    const { r, code } = await opened();
    await r.text(R1, `ACK ${code}`);
    await r.text(GIRL, "FUTA");
    assert.match(r.inbox(R1).at(-1)!, /withdrawn by the user.*Do not contact her/);
  });
});

describe("escalation and retention", () => {
  it("urgent: re-alert every 10 min, then focal person, who can ACK", async () => {
    const r = await rig();
    await r.text(GIRL, "MSAADA mbeya"); await r.text(GIRL, "NDIO");
    const code = (await r.store.listCases())[0].code;
    r.advance(9); await r.p.sweep();
    assert.equal(r.inbox(R1).length, 1);
    r.advance(1); await r.p.sweep();
    assert.equal(r.inbox(R1).length, 2);
    r.advance(10); await r.p.sweep();
    assert.equal(r.inbox(R1).length, 3);
    assert.equal(r.inbox(FOCAL).length, 0);
    r.advance(10); const s = await r.p.sweep();
    assert.equal(s.escalated, 1);
    assert.match(r.inbox(FOCAL)[0], /ESCALATION/);
    await r.text(FOCAL, `ACK ${code}`);
    assert.equal((await r.store.getCaseByCode(code))!.status, "accepted");
    r.advance(60); await r.p.sweep();
    assert.equal(r.inbox(FOCAL).length, 2, "no more alerts once accepted");
  });
  it("normal priority (anonymous report) waits 30 min between alerts", async () => {
    const r = await rig();
    await r.text(GIRL, "RIPOTI mbeya");
    r.advance(29); await r.p.sweep(); assert.equal(r.inbox(R1).length, 1);
    r.advance(1); await r.p.sweep(); assert.equal(r.inbox(R1).length, 2);
  });
  it("no responder on duty: goes straight to the focal person", async () => {
    const r = await rig();
    await r.text(GIRL, "RIPOTI kyela");
    assert.match(r.inbox(FOCAL)[0], /ESCALATION|SALAMA/);
  });
  it("unanswered contact details are wiped automatically after the retention window", async () => {
    const r = await rig({ cfg: { retentionHours: 24 } });
    await r.text(GIRL, "MSAADA mbeya"); await r.text(GIRL, "NDIO");
    r.advance(24 * 60 + 1);
    const s = await r.p.sweep();
    assert.equal(s.wiped, 1);
    const [c] = await r.store.listCases();
    assert.equal(c.status, "withdrawn"); assert.ok(!c.phoneEnc && !c.phoneHash);
  });
});

describe("partner statistics", () => {
  it("hides small counts and never prints a total next to a hidden cell", () => {
    const r = suppress([{ name: "a", count: 12 }, { name: "b", count: 3 }], 5);
    assert.deepEqual(r.rows.map((x) => x.count), [12, "<5"]);
    assert.equal(r.total, null);
    assert.equal(suppress([{ name: "a", count: 12 }, { name: "b", count: 9 }], 5).total, 21);
  });
  it("small deployments show nothing identifying", async () => {
    const r = await rig();
    await r.text(GIRL, "RIPOTI mbeya");
    const s = await r.p.stats();
    assert.equal(String(s.response.cases), "<5");
    assert.ok(s.byEvent.rows.every((x) => x.count === "<5"));
    assert.equal(s.byEvent.total, null);
  });
  it("reports response speed once volume is high enough", async () => {
    const r = await rig();
    for (let i = 0; i < 6; i += 1) {
      await r.text(`+2557120000${i}0`, "MSAADA mbeya"); await r.text(`+2557120000${i}0`, "NDIO");
    }
    const cases = await r.store.listCases();
    r.advance(12);
    for (const c of cases.slice(0, 4)) await r.text(R1, `ACK ${c.code}`);
    const s = await r.p.stats();
    assert.equal(s.response.cases, 6); assert.equal(s.response.answered, 4);
    assert.equal(s.response.medianMinutesToAnswer, 12);
  });
});

describe("logging", () => {
  it("the console gateway and error paths never log numbers or message text", async () => {
    const lines: string[] = [];
    const orig = [console.log, console.error];
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try {
      const r = await rig();
      (r.p as any); // gateways replaced below
      const { createPlatform } = await import("./platform.ts");
      const { defaultConfig } = await import("./core.ts");
      const p = createPlatform({ store: r.store, cfg: defaultConfig(r.keys), gateways: { sms: new ConsoleGateway() }, now: () => r.clock.t });
      await p.text({ from: GIRL, text: "MSAADA mbeya", channel: "sms" });
      await p.text({ from: GIRL, text: "NDIO", channel: "sms" });
    } finally { [console.log, console.error] = orig as any; }
    assert.ok(lines.length > 0);
    for (const l of lines) { assert.ok(!l.includes("712345678"), l); assert.ok(!/Msimbo|SALAMA/.test(l), l); }
  });
});
