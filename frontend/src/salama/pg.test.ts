import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgStore } from "./store.pg.ts";
import { MemoryStore } from "./store.memory.ts";
import type { Case, Store } from "./types.ts";
import { FOCAL, GIRL, R1, rig } from "./test-helpers.ts";

// Real schema, real SQL: the same migration the deploy runs, on embedded Postgres.
async function freshPg(): Promise<PgStore> {
  const pg = new PGlite({ parsers: { 20: Number } as any });
  await pg.waitReady;
  await pg.exec(readFileSync(new URL("../../migrations/0002_salamaline.sql", import.meta.url), "utf8"));
  const sql: any = async (s: TemplateStringsArray, ...v: unknown[]) => (await pg.query(s.join("?"), v)).rows;
  sql.query = async (t: string, p: unknown[] = []) => (await pg.query(t, p)).rows;
  return new PgStore(sql);
}

const mk = (code: string, over: Partial<Case> = {}): Case => ({
  id: `id-${code}`, code, kind: "marriage", anonymous: false, priority: "urgent", district: "mbeya-city",
  channel: "ussd", status: "open", createdAt: 1000, lastAlertAt: 1000, alertCount: 1, escalatedAt: null,
  acceptedAt: null, closedAt: null, responderId: null, phoneHash: "h1", phoneEnc: "v1:x", ...over,
});

// The same contract, run against BOTH stores: they must behave identically.
for (const [name, make] of [["MemoryStore", async () => new MemoryStore() as Store], ["PgStore (Postgres schema)", async () => (await freshPg()) as Store]] as const) {
  describe(`${name} contract`, () => {
    it("cases: create, read, patch, filter", async () => {
      const s = await make();
      await s.createCase(mk("AAAA")); await s.createCase(mk("BBBB", { status: "closed", phoneHash: null, phoneEnc: null }));
      assert.equal((await s.getCaseByCode("AAAA"))!.phoneEnc, "v1:x");
      assert.equal((await s.listCases({ status: "open" })).length, 1);
      assert.equal((await s.listCases({ phoneHash: "h1" })).length, 1);
      const u = await s.updateCase("AAAA", { status: "accepted", acceptedAt: 5000, responderId: "r1" });
      assert.deepEqual([u!.status, u!.acceptedAt, u!.responderId], ["accepted", 5000, "r1"]);
      assert.equal(await s.updateCase("ZZZZ", { status: "closed" }), null);
      assert.equal((await s.getCaseByCode("BBBB"))!.escalatedAt, null);
    });
    it("pending consent is single-use and expires", async () => {
      const s = await make();
      await s.setPending({ key: "k", kind: "fgm", district: "kyela", expiresAt: 2000 });
      assert.equal((await s.takePending("k", 1000))!.kind, "fgm");
      assert.equal(await s.takePending("k", 1000), null);
      await s.setPending({ key: "k", kind: "fgm", district: "kyela", expiresAt: 2000 });
      assert.equal(await s.takePending("k", 2000), null);
    });
    it("claimOnce is idempotent until it expires", async () => {
      const s = await make();
      assert.equal(await s.claimOnce("x", 0, 100), true);
      assert.equal(await s.claimOnce("x", 50, 100), false);
      assert.equal(await s.claimOnce("x", 100, 100), true);
    });
    it("counters aggregate", async () => {
      const s = await make();
      const row = { day: "2026-10-22", event: "help:fgm", district: "kyela", channel: "sms" as const };
      await s.bump(row); await s.bump(row);
      assert.equal((await s.counters())[0].count, 2);
    });
    it("erase wipes contact data, withdraws open cases, keeps closed ones as-is", async () => {
      const s = await make();
      await s.createCase(mk("AAAA")); await s.createCase(mk("BBBB", { status: "closed", closedAt: 1 }));
      await s.setPending({ key: "h1", kind: "fgm", district: "kyela", expiresAt: 9e9 });
      const touched = await s.eraseByPhoneHash("h1", 7000);
      assert.equal(touched.length, 2);
      const a = (await s.getCaseByCode("AAAA"))!, b = (await s.getCaseByCode("BBBB"))!;
      assert.deepEqual([a.status, a.closedAt, a.phoneEnc, a.phoneHash], ["withdrawn", 7000, null, null]);
      assert.deepEqual([b.status, b.closedAt, b.phoneEnc], ["closed", 1, null]);
      assert.equal(await s.takePending("h1", 0), null);
    });
    it("responders: list by district/role, lookup by hash, deactivate", async () => {
      const s = await make();
      await s.addResponder({ id: "r1", name: "A", phone: R1, phoneHash: "p1", district: "mbeya-city", role: "responder", active: true });
      await s.addResponder({ id: "f1", name: "F", phone: FOCAL, phoneHash: "p9", district: "*", role: "focal", active: true });
      assert.equal((await s.listResponders({ district: "mbeya-city", role: "responder", activeOnly: true })).length, 1);
      assert.equal((await s.getResponderByHash("p9"))!.role, "focal");
      assert.equal(await s.setResponderActive("r1", false), true);
      assert.equal(await s.getResponderByHash("p1"), null);
      assert.equal((await s.listResponders({ activeOnly: true })).length, 1);
    });
  });
}

describe("full platform flow on the Postgres schema", () => {
  let r: Awaited<ReturnType<typeof rig>>;
  before(async () => { r = await rig({ store: await freshPg() }); });
  it("consent -> alert -> ACK -> CLOSE wipes the number in the database", async () => {
    await r.text(GIRL, "MSAADA mbeya NDOA"); await r.text(GIRL, "NDIO");
    const [c] = await r.store.listCases();
    assert.ok(c.phoneEnc && c.phoneHash);
    await r.text(R1, `ACK ${c.code}`);
    assert.match(r.inbox(R1).at(-1)!, /\+255712345678/);
    await r.text(R1, `CLOSE ${c.code}`);
    const done = (await r.store.getCaseByCode(c.code))!;
    assert.equal(done.status, "closed"); assert.ok(done.phoneEnc === null && done.phoneHash === null);
  });
  it("escalation and stats work end to end", async () => {
    await r.text(GIRL, "FGM mbeya"); await r.text(GIRL, "NDIO");
    for (let i = 0; i < 4; i += 1) { r.advance(10); await r.p.sweep(); }
    assert.ok(r.inbox(FOCAL).some((m) => /ESCALATION/.test(m)));
    const s = await r.p.stats();
    assert.ok(s.byEvent.rows.length > 0);
  });
  it("USSD idempotency holds in Postgres", async () => {
    await r.ussd("2*3*1*1*1", "pg-dup"); await r.ussd("2*3*1*1*1", "pg-dup");
    const mine = (await r.store.listCases()).filter((c) => c.channel === "ussd");
    assert.equal(mine.length, 1);
  });
});
