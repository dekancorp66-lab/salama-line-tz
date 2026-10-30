import type { Sql } from "../lib/db.ts";
import type { Case, CaseStatus, CounterRow, Pending, Responder, Store } from "./types.ts";

// camelCase field -> column. Also the whitelist for updateCase(): a patch key
// that is not listed here can never reach the SQL text.
const COL: Record<keyof Case, string> = {
  id: "id", code: "code", kind: "kind", anonymous: "anonymous", priority: "priority",
  district: "district", channel: "channel", status: "status", createdAt: "created_at",
  lastAlertAt: "last_alert_at", alertCount: "alert_count", escalatedAt: "escalated_at",
  acceptedAt: "accepted_at", closedAt: "closed_at", responderId: "responder_id",
  phoneHash: "phone_hash", phoneEnc: "phone_enc",
};

const toCase = (r: any): Case => ({
  id: r.id, code: r.code, kind: r.kind, anonymous: r.anonymous, priority: r.priority,
  district: r.district, channel: r.channel, status: r.status,
  createdAt: Number(r.created_at), lastAlertAt: Number(r.last_alert_at),
  alertCount: Number(r.alert_count),
  escalatedAt: r.escalated_at == null ? null : Number(r.escalated_at),
  acceptedAt: r.accepted_at == null ? null : Number(r.accepted_at),
  closedAt: r.closed_at == null ? null : Number(r.closed_at),
  responderId: r.responder_id, phoneHash: r.phone_hash, phoneEnc: r.phone_enc,
});
const toResponder = (r: any): Responder => ({
  id: r.id, name: r.name, phone: r.phone, phoneHash: r.phone_hash,
  district: r.district, role: r.role, active: r.active,
});

/** Postgres-backed store (Neon in production, PGLite in local preview). */
export class PgStore implements Store {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }

  async addResponder(r: Responder) {
    await this.sql.query(
      `insert into sl_responders (id,name,phone,phone_hash,district,role,active)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set name=$2, phone=$3, phone_hash=$4, district=$5, role=$6, active=$7`,
      [r.id, r.name, r.phone, r.phoneHash, r.district, r.role, r.active],
    );
  }
  async listResponders(f: { district?: string; role?: Responder["role"]; activeOnly?: boolean } = {}) {
    const rows = await this.sql.query(
      `select * from sl_responders
       where ($1::text is null or district = $1) and ($2::text is null or role = $2)
         and (not $3::boolean or active) order by id`,
      [f.district ?? null, f.role ?? null, !!f.activeOnly],
    );
    return rows.map(toResponder);
  }
  async getResponderByHash(hash: string) {
    const rows = await this.sql.query("select * from sl_responders where phone_hash=$1 and active", [hash]);
    return rows[0] ? toResponder(rows[0]) : null;
  }
  async setResponderActive(id: string, active: boolean) {
    const rows = await this.sql.query("update sl_responders set active=$2 where id=$1 returning id", [id, active]);
    return rows.length > 0;
  }

  async createCase(c: Case) {
    const keys = Object.keys(COL) as (keyof Case)[];
    await this.sql.query(
      `insert into sl_cases (${keys.map((k) => COL[k]).join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      keys.map((k) => c[k]),
    );
  }
  async getCaseByCode(code: string) {
    const rows = await this.sql.query("select * from sl_cases where code=$1", [code]);
    return rows[0] ? toCase(rows[0]) : null;
  }
  async updateCase(code: string, patch: Partial<Case>) {
    const keys = (Object.keys(patch) as (keyof Case)[]).filter((k) => k in COL);
    if (!keys.length) return this.getCaseByCode(code);
    const rows = await this.sql.query(
      `update sl_cases set ${keys.map((k, i) => `${COL[k]}=$${i + 2}`).join(",")} where code=$1 returning *`,
      [code, ...keys.map((k) => patch[k])],
    );
    return rows[0] ? toCase(rows[0]) : null;
  }
  async listCases(f: { status?: CaseStatus; phoneHash?: string } = {}) {
    const rows = await this.sql.query(
      `select * from sl_cases where ($1::text is null or status=$1) and ($2::text is null or phone_hash=$2) order by created_at`,
      [f.status ?? null, f.phoneHash ?? null],
    );
    return rows.map(toCase);
  }

  async setPending(p: Pending) {
    await this.sql.query(
      `insert into sl_pending (key,kind,district,expires_at) values ($1,$2,$3,$4)
       on conflict (key) do update set kind=$2, district=$3, expires_at=$4`,
      [p.key, p.kind, p.district, p.expiresAt],
    );
  }
  async takePending(key: string, now: number) {
    // Atomic get-and-delete: a consent can be used exactly once, even under retries.
    const rows = await this.sql.query<any>("delete from sl_pending where key=$1 returning *", [key]);
    const r = rows[0];
    return r && Number(r.expires_at) > now
      ? { key: r.key, kind: r.kind, district: r.district, expiresAt: Number(r.expires_at) } as Pending
      : null;
  }

  async claimOnce(key: string, now: number, ttlMs: number) {
    const rows = await this.sql.query(
      `insert into sl_once (key, expires_at) values ($1, $3)
       on conflict (key) do update set expires_at = $3 where sl_once.expires_at <= $2
       returning key`,
      [key, now, now + ttlMs],
    );
    return rows.length > 0;
  }

  async bump(row: Omit<CounterRow, "count">) {
    await this.sql.query(
      `insert into sl_counters (day,event,district,channel,count) values ($1,$2,$3,$4,1)
       on conflict (day,event,district,channel) do update set count = sl_counters.count + 1`,
      [row.day, row.event, row.district, row.channel],
    );
  }
  async counters() {
    const rows = await this.sql.query<any>("select * from sl_counters");
    return rows.map((r) => ({ day: r.day, event: r.event, district: r.district, channel: r.channel, count: Number(r.count) })) as CounterRow[];
  }

  async eraseByPhoneHash(hash: string, now: number) {
    await this.sql.query("delete from sl_pending where key=$1", [hash]);
    const before = await this.sql.query("select * from sl_cases where phone_hash=$1", [hash]);
    await this.sql.query(
      `update sl_cases set phone_hash=null, phone_enc=null,
         status = case when status in ('open','accepted') then 'withdrawn' else status end,
         closed_at = case when status in ('open','accepted') then $2 else closed_at end
       where phone_hash=$1`,
      [hash, now],
    );
    return before.map(toCase);
  }
  async purgeExpired(now: number) {
    await this.sql.query("delete from sl_pending where expires_at <= $1", [now]);
    await this.sql.query("delete from sl_once where expires_at <= $1", [now]);
  }
}
