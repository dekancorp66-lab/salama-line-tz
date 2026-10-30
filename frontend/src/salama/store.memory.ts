import type { Case, CaseStatus, CounterRow, Pending, Responder, Store } from "./types.ts";

/** In-memory store: used by tests, the live simulator, and local dev. */
export class MemoryStore implements Store {
  responders = new Map<string, Responder>();
  cases = new Map<string, Case>(); // by code
  pending = new Map<string, Pending>();
  once = new Map<string, number>();
  counts = new Map<string, CounterRow>();

  async addResponder(r: Responder) {
    this.responders.set(r.id, { ...r });
  }
  async listResponders(f: { district?: string; role?: Responder["role"]; activeOnly?: boolean } = {}) {
    return [...this.responders.values()].filter(
      (r) =>
        (!f.district || r.district === f.district) &&
        (!f.role || r.role === f.role) &&
        (!f.activeOnly || r.active),
    );
  }
  async getResponderByHash(hash: string) {
    return [...this.responders.values()].find((r) => r.phoneHash === hash && r.active) ?? null;
  }
  async setResponderActive(id: string, active: boolean) {
    const r = this.responders.get(id);
    if (!r) return false;
    r.active = active;
    return true;
  }

  async createCase(c: Case) {
    this.cases.set(c.code, { ...c });
  }
  async getCaseByCode(code: string) {
    const c = this.cases.get(code);
    return c ? { ...c } : null;
  }
  async updateCase(code: string, patch: Partial<Case>) {
    const c = this.cases.get(code);
    if (!c) return null;
    Object.assign(c, patch);
    return { ...c };
  }
  async listCases(f: { status?: CaseStatus; phoneHash?: string } = {}) {
    return [...this.cases.values()]
      .filter((c) => (!f.status || c.status === f.status) && (!f.phoneHash || c.phoneHash === f.phoneHash))
      .map((c) => ({ ...c }));
  }

  async setPending(p: Pending) {
    this.pending.set(p.key, { ...p });
  }
  async takePending(key: string, now: number) {
    const p = this.pending.get(key);
    this.pending.delete(key);
    return p && p.expiresAt > now ? p : null;
  }

  async claimOnce(key: string, now: number, ttlMs: number) {
    const exp = this.once.get(key);
    if (exp && exp > now) return false;
    this.once.set(key, now + ttlMs);
    return true;
  }

  async bump(row: Omit<CounterRow, "count">) {
    const k = [row.day, row.event, row.district, row.channel].join("|");
    const cur = this.counts.get(k);
    if (cur) cur.count += 1;
    else this.counts.set(k, { ...row, count: 1 });
  }
  async counters() {
    return [...this.counts.values()].map((r) => ({ ...r }));
  }

  async eraseByPhoneHash(hash: string, now: number) {
    this.pending.delete(hash);
    const touched: Case[] = [];
    for (const c of this.cases.values()) {
      if (c.phoneHash !== hash) continue;
      touched.push({ ...c });
      c.phoneHash = null;
      c.phoneEnc = null;
      if (c.status === "open" || c.status === "accepted") {
        c.status = "withdrawn";
        c.closedAt = now;
      }
    }
    return touched;
  }
  async purgeExpired(now: number) {
    for (const [k, p] of this.pending) if (p.expiresAt <= now) this.pending.delete(k);
    for (const [k, e] of this.once) if (e <= now) this.once.delete(k);
  }
}
