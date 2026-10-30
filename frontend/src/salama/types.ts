// Shared types for the SalamaLine engine. Pure TypeScript, no framework imports,
// so every rule can be unit-tested with `node --test` and no server running.

export type Channel = "ussd" | "sms" | "whatsapp";
export type Lang = "sw" | "en";

/** What the girl (or reporter) is asking about. Drives responder protocol text. */
export type CaseKind = "marriage" | "fgm" | "violence" | "counsellor" | "general";

export type CaseStatus = "open" | "accepted" | "closed" | "withdrawn";

export interface Case {
  id: string;
  /** Short code shown to girl + responders. Not derived from any personal data. */
  code: string;
  kind: CaseKind;
  /** Anonymous concern reports never have a phone number attached. */
  anonymous: boolean;
  priority: "urgent" | "normal";
  district: string;
  channel: Channel;
  status: CaseStatus;
  createdAt: number;
  lastAlertAt: number;
  alertCount: number;
  escalatedAt: number | null;
  acceptedAt: number | null;
  closedAt: number | null;
  responderId: string | null;
  /** Keyed hash, only so the user can withdraw (FUTA). Wiped at closure. */
  phoneHash: string | null;
  /** AES-GCM ciphertext, only with consent. Wiped at closure. */
  phoneEnc: string | null;
}

export interface Responder {
  id: string;
  name: string;
  phone: string; // E.164. Staff numbers, not girls' numbers.
  phoneHash: string;
  /** District id, or "*" for a focal person who covers every district. */
  district: string;
  role: "responder" | "focal";
  active: boolean;
}

export interface Pending {
  key: string; // phone hash
  kind: CaseKind;
  district: string;
  expiresAt: number;
}

export interface CounterRow {
  day: string;
  event: string;
  district: string;
  channel: Channel;
  count: number;
}

export interface Outbound {
  to: string;
  text: string;
  /** Which gateway to prefer. Alerts to responders always go by SMS. */
  via?: Channel;
}

/** Everything the engine needs from persistence. Memory + Postgres implement it. */
export interface Store {
  addResponder(r: Responder): Promise<void>;
  listResponders(f?: { district?: string; role?: Responder["role"]; activeOnly?: boolean }): Promise<Responder[]>;
  getResponderByHash(hash: string): Promise<Responder | null>;
  setResponderActive(id: string, active: boolean): Promise<boolean>;

  createCase(c: Case): Promise<void>;
  getCaseByCode(code: string): Promise<Case | null>;
  updateCase(code: string, patch: Partial<Case>): Promise<Case | null>;
  listCases(f?: { status?: CaseStatus; phoneHash?: string }): Promise<Case[]>;

  setPending(p: Pending): Promise<void>;
  /** Returns the pending consent and deletes it (one use). Expired = null. */
  takePending(key: string, now: number): Promise<Pending | null>;

  /** Idempotency guard: true the first time a key is seen, false on retries. */
  claimOnce(key: string, now: number, ttlMs: number): Promise<boolean>;

  bump(row: Omit<CounterRow, "count">): Promise<void>;
  counters(): Promise<CounterRow[]>;

  /** Wipe pending consent + every contact detail tied to this hash. */
  eraseByPhoneHash(hash: string, now: number): Promise<Case[]>;
  purgeExpired(now: number): Promise<void>;
}

export interface District {
  id: string;
  name: string;
  aliases: string[];
}

export type ServiceKind = "clinic" | "legal" | "welfare" | "counselling";

export interface ServiceEntry {
  id: string;
  kind: ServiceKind;
  name: string;
  district: string;
  phone: string;
  hours: string;
  /** Named partner who verified it. null = placeholder, hidden in live mode. */
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export type Topic = "marriage" | "fgm" | "online" | "health";

export interface ContentItem {
  id: string;
  topic: Topic;
  lang: Lang;
  /** Fits a USSD screen (about 110 characters). */
  short: string;
  /** Full text sent by SMS (under 450 characters). */
  full: string;
  source: string;
  reviewer: string | null;
  reviewedAt: string | null;
  /** Only "approved" is served in live mode. */
  status: "approved" | "placeholder";
}
