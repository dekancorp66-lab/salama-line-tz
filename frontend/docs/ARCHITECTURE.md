# Architecture

```
USSD (/api/ussd) ─┐
SMS  (/api/sms)  ─┼─> ussd.ts / sms.ts  ──> core.ts (all rules) ──> Store (Postgres | Memory)
WhatsApp         ─┘     thin front-ends      consent, cases,         + Gateway (SMS out)
(/api/whatsapp)                              ack/close, erase,
/api/cron/sweep ─────────────────────────>   escalation, retention
/api/stats ──> stats.ts (small-count suppression)      /dashboard (partners)
/api/simulate ─> same engine, isolated sandbox         website simulator
```

- `src/salama/core.ts` is the only place rules live. USSD and SMS cannot drift apart.
- `privacy.ts`: keyed HMAC for lookups, AES-256-GCM only with consent, log redaction.
- `data/`: districts, approved content, service directory. A new region = new data, no code.
- USSD keeps no session state: the path is replayed each request; effects fire only on the newest input and are idempotent.
- Tests: `npm test` (engine on memory + the real Postgres schema via PGLite).
