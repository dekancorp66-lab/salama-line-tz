import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp, splitMessage } from "./whatsapp.ts";
import { MemoryStore } from "./store.memory.ts";
import { rig, GIRL } from "./test-helpers.ts";

const wrap = (messages: unknown[]) => ({ entry: [{ changes: [{ value: { messages } }] }] });

describe("WhatsApp webhook parsing", () => {
  it("reads text messages and normalises the number", () => {
    const r = parseWhatsApp(wrap([{ id: "w1", from: "255712345678", type: "text", text: { body: "HELP Mbeya" } }]));
    assert.deepEqual(r, [{ id: "w1", from: "+255712345678", text: "HELP Mbeya", unsupported: false }]);
  });
  it("reads button and list replies", () => {
    const r = parseWhatsApp(wrap([
      { id: "a", from: "255712345678", type: "interactive", interactive: { button_reply: { id: "NDIO", title: "Yes" } } },
      { id: "b", from: "255712345678", type: "interactive", interactive: { list_reply: { id: "KLINIKI", title: "Clinic" } } },
      { id: "c", from: "255712345678", type: "button", button: { payload: "HAPANA", text: "No" } },
    ]));
    assert.deepEqual(r.map((x) => x.text), ["NDIO", "KLINIKI", "HAPANA"]);
  });
  it("flags photos and voice notes as unsupported", () => {
    const r = parseWhatsApp(wrap([{ id: "i", from: "255712345678", type: "image" }, { id: "v", from: "255712345678", type: "audio" }]));
    assert.equal(r.length, 2);
    assert.ok(r.every((x) => x.unsupported && x.text === ""));
  });
  it("ignores receipts, reactions, empty text and garbage", () => {
    assert.deepEqual(parseWhatsApp({ entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "read" }] } }] }] }), []);
    assert.deepEqual(parseWhatsApp(wrap([{ id: "r", from: "255712345678", type: "reaction" }, { id: "t", from: "255712345678", type: "text", text: { body: "   " } }])), []);
    for (const junk of [null, undefined, 5, "x", {}, { entry: "no" }, { entry: [{ changes: null }] }]) assert.deepEqual(parseWhatsApp(junk), []);
  });
  it("never reads the sender's profile name", () => {
    const body = { entry: [{ changes: [{ value: { contacts: [{ profile: { name: "Asha" }, wa_id: "255712345678" }], messages: [{ id: "n", from: "255712345678", type: "text", text: { body: "hi" } }] } }] }] };
    assert.ok(!JSON.stringify(parseWhatsApp(body)).includes("Asha"));
  });
});

describe("splitting long WhatsApp replies", () => {
  it("leaves short text alone", () => assert.deepEqual(splitMessage("hello"), ["hello"]));
  it("splits at newlines and loses nothing", () => {
    const text = Array.from({ length: 400 }, (_, i) => `line ${i} ${"x".repeat(20)}`).join("\n");
    const parts = splitMessage(text, 1000);
    assert.ok(parts.length > 1 && parts.every((p) => p.length <= 1000));
    assert.equal(parts.join("\n").replace(/\s+/g, ""), text.replace(/\s+/g, ""));
  });
  it("hard-cuts a single very long word", () => {
    const parts = splitMessage("y".repeat(2500), 1000);
    assert.deepEqual(parts.map((p) => p.length), [1000, 1000, 500]);
  });
});

describe("WhatsApp end to end", () => {
  it("answers a WhatsApp message on WhatsApp, not SMS", async () => {
    const r = await rig();
    await r.p.text({ from: GIRL, text: "SALAMA", channel: "whatsapp" });
    assert.ok(r.wa.sent.length >= 1);
    assert.equal(r.sms.sent.filter((m) => m.to === GIRL).length, 0);
  });
  it("an empty command (photo / voice note) gets the help reply", async () => {
    const r = await rig();
    await r.p.text({ from: GIRL, text: "", channel: "whatsapp" });
    assert.ok(r.wa.sent.some((m) => m.to === GIRL && m.text.length > 0));
  });
  it("a retried message id is processed only once", async () => {
    const s = new MemoryStore();
    assert.equal(await s.claimOnce("wa:abc", 0, 1000), true);
    assert.equal(await s.claimOnce("wa:abc", 10, 1000), false);
  });
});
