# SalamaLine mobile — Phase 1 technical assessment

Status: **inspection complete; no architectural changes made**.
Scope: read-only inspection of `/Users/wilbard/Desktop/salama-line-tz` on 2026-11-20.
Method: full repository inventory, four focused source audits (backend API/auth, data layer/domain rules, web frontend, docs/config/gaps), plus direct verification of critical files and a baseline test run.

---

## 1. Repository shape

| Area | Path | What it is |
|---|---|---|
| Backend | `backend/` | NestJS 10-style REST API, TypeScript, Prisma/PostgreSQL, Jest tests. Public prefix `/api/v1`. |
| Web frontend | `frontend/` | TanStack Start + React 19 + Vite + Tailwind v4 web app, PWA/server routes, its own PGLite/Neon SQL layer and channel simulator. |
| Docs | `backend/docs/`, `frontend/docs/` | Backend API examples, architecture, security notes; web go-live notes. |
| CI | `.github/workflows/ci.yml` | Backend-only: Postgres 16, `prisma generate`, `migrate deploy`, `build`, `test`. |
| Mobile | — | **Does not exist.** No `mobile/`, Expo/RN packages, `app.json`, `eas.json`, `metro.config.*`, `android/`, `ios/`, or mobile CI. |

Root `README.md` documents only the backend. No document in the repo mentions React Native, Expo, mobile builds, push notifications, or the mobile specification in this request.

Two independent HTTP systems must not be confused:

1. NestJS backend at `/api/v1/*` — the API the native app must consume.
2. Frontend server routes at `/api/simulate`, `/api/health`, `/api/sms`, `/api/ussd`, `/api/whatsapp`, `/api/stats`, `/api/cron/sweep` — the **web channel simulator**, not NestJS endpoints.

---

## 2. Backend architecture

### Bootstrap and global wiring

`backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/config/runtime-config.ts`:

- `helmet()` security headers; Express `trust proxy` from `TRUST_PROXY` (default `false`).
- CORS allowlist from `FRONTEND_ORIGINS` (defaults to three localhost origins); `credentials: false`. **No mobile/custom-scheme origins are configured.**
- Global prefix from `API_PREFIX`, default `api/v1`.
- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, implicit conversion enabled.
- Global `ThrottlerGuard`, 60 requests / 60 s; per-route overrides on auth, tracking and AI routes.
- Swagger at literal `/docs`, **only when `SWAGGER_ENABLED=true`**.
- No global auth guard, no global interceptors, no global exception filter. Routes are public unless individually guarded.
- Required config: `DATABASE_URL`, `JWT_ACCESS_SECRET` (≥32 chars, no dev fallback). Production also requires `CONTACT_HASH_SECRET` and a non-empty `FRONTEND_ORIGINS`. Default `JWT_ACCESS_TTL=15m`.

### Modules

`PrismaModule` (global), `HealthModule`, `AuthModule`, `ContentModule`, `ServicesModule`, `HelpRequestsModule`, `AdminModule`, `AuditModule`, `IntegrationsModule`, `AiModule`.

Auth is per-endpoint via `JwtAuthGuard` + `RolesGuard` + `@Roles(...)`. `JwtStrategy` (`auth/jwt.strategy.ts:5-28`) verifies the bearer token, loads the user from the database, rejects inactive users or `payload.ver !== user.tokenVersion`, and returns `{ id, email, role, districtCode, institutionId }` from the database rather than trusting the token's role. Role sets live in `common/roles.ts`. `RolesGuard` uses `getAllAndOverride`, so a method-level `@Roles` overrides the class-level admin roles on `AdminController`.

### Complete route inventory (all prefixed `/api/v1`)

**Public / relevant to a native app**

| Method + path | Purpose | Notes |
|---|---|---|
| `GET /health`, `GET /health/ready` | Liveness, DB readiness | `ready` returns 500 if `SELECT 1` fails. |
| `POST /auth/register` | Create account | **Creates an inactive `RESPONDER` staff account**, not a public `USER`. 5/min. |
| `POST /auth/login` | Staff login | Returns `{accessToken, tokenType, expiresIn, user}`. 10/min. 15 m TTL. |
| `POST /auth/password-reset/request` | Request recovery token | 3/min. Token is hashed and stored but **never delivered or returned**. |
| `POST /auth/password-reset/confirm` | Complete reset | 5/min. Increments `tokenVersion`, invalidating existing tokens. |
| `GET /auth/me` | Current user | Guarded. |
| `GET /content?language=sw&topic=...` | Approved learning content | Defaults to `sw`; only `APPROVED`; no DTO validation on query. |
| `GET /services?district=...&type=...` | Verified services | Only `isActive`, `verifiedAt <= now`, unexpired; exact-match filters. |
| `POST /help-requests` | Submit confidential request | Returns `{id, caseCode, ...}`. No automatic contact of anyone. |
| `GET /case-tracking/:caseCode` | Public, coarse status tracking | 8/min. Deliberately minimal response; no details, district, referrals or notes. |
| `GET /ai/health`, `POST /ai/ask` | AI Q&A | Public; `ask` 10/min; grounded in local JSONL knowledge, optional gated OpenAI provider. |
| `GET /integrations/status` | Channel readiness | USSD/SMS/WhatsApp all report `configured:false, operational:false`. |

**Staff/admin only (must not be exposed in the public mobile UI)**

- Cases: `GET /help-requests`, `GET /help-requests/:id`, `PATCH /:id/status`, `POST /:id/assign`, `PATCH /:id/institution`, `GET|POST /:id/notes`, `POST /:id/escalate`, `POST /:id/consent/grant`, `POST /:id/consent/revoke`, `GET|POST /:id/referrals`, `POST /retention/sweep`.
- Admin: institutions, users, officers, access/availability, verified services, content queue/archive, consent policies, AI knowledge approval, audit, metrics (`backend/src/admin/admin.controller.ts:83-841`).
- Content creation/review: `POST /content`, `POST /content/:id/review`.

### DTO/validation surface

`class-validator` DTOs cover body and param payloads: auth, help request intake, tracking code (`^SL-[0-9A-F]{8}(?:[0-9A-F]{8})?$`), status updates, assignment, notes, referrals, escalation, consent, content, and all admin DTOs. Password policy is length-only (12–128 chars) for registration and reset. Most GET query strings are plain strings; only admin `take`/`skip` use `ParseIntPipe`.

---

## 3. Data model and domain rules

`backend/prisma/schema.prisma` (PostgreSQL, 5 migrations in `backend/prisma/migrations/`, final migrated state agrees with the schema).

### Enums (exact values)

- `UserRole`: `ADMIN`, `SUPER_ADMIN`, `RESPONDER`, `CONTENT_REVIEWER`, `CONTENT_MANAGER`, `SERVICE_MANAGER`, `AUDITOR`, `PARTNER_ANALYST`, `USER`. `USER` is declared but **unused by any route or guard**.
- `HelpRequestStatus`: `NEW`, `PENDING`, `PENDING_REVIEW`, `ACCEPTED`, `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `REFERRED`, `RESOLVED`, `CLOSED`, `CANCELLED`, `EXPIRED`.
- `HelpRequestPriority`: `NORMAL`, `URGENT`.
- `ConsentPurpose`: `CONTACT_FOR_HELP`, `SHARE_WITH_SERVICE`, `FOLLOW_UP`.
- `ConsentDecision`: `GRANTED`, `DECLINED`, `REVOKED`.
- `ContentStatus`: `DRAFT`, `IN_REVIEW`, `APPROVED`, `ARCHIVED`. `IN_REVIEW` is never assigned by application code.
- `ServiceType`: `CLINIC`, `LEGAL_AID`, `SOCIAL_WELFARE`, `SHELTER`, `COUNSELLING`, `OTHER`.
- `Channel`: `WEB`, `USSD`, `SMS`, `WHATSAPP`, `STAFF`.

### Models

`Institution`, `User`, `Content`, `ServiceDirectoryEntry`, `HelpRequest`, `ConsentRecord`, `Referral`, `AuditEvent`, `AnonymousMetric`, `Permission`, `RolePermission`, `ResponderProfile`, `ConsentPolicy`, `CaseNote`, `CaseAssignmentEvent`, `EscalationEvent`, `NotificationOutbox`, `AiKnowledgeSource`. Full field-level inventory is in the Prisma file; key privacy facts:

- `User` has `isActive`, `failedLoginAttempts`, `lockedUntil`, `tokenVersion`, `passwordResetTokenHash/ExpiresAt`.
- `HelpRequest` stores hashed contact (`contactHash`) not raw contact; `contactCiphertext` is never written by application code; `concernSummary` is redacted and truncated; GPS coordinates only with `locationConsentGiven`.
- `HelpRequest` has no owner/user relation. Requests are not tied to accounts.
- `Referral.serviceEntryId` is a plain string with no FK; referral `status` is a free string (default `OFFERED`) and no endpoint updates it.
- `Permission`/`RolePermission` are inactive scaffolding; authorization is role-based.
- Seeding is promotion-only: `prisma/seed.ts` → `bootstrap-super-admin.ts` promotes an existing allowlisted email to `SUPER_ADMIN`. It does not create accounts or set passwords. The root README's seed instructions are stale.

### Status/transition rules (`help-requests.service.ts:46-124`)

Open: `NEW`, `PENDING`, `PENDING_REVIEW`, `ACCEPTED`, `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `REFERRED`.
Terminal: `RESOLVED`, `CLOSED`, `CANCELLED`, `EXPIRED`.

```text
NEW            -> PENDING, PENDING_REVIEW, CANCELLED
PENDING        -> ACCEPTED, ASSIGNED, PENDING_REVIEW, CANCELLED, EXPIRED
PENDING_REVIEW -> ACCEPTED, ASSIGNED, CANCELLED
ACCEPTED       -> IN_PROGRESS, ASSIGNED, ESCALATED, REFERRED, RESOLVED, CLOSED, CANCELLED
ASSIGNED       -> IN_PROGRESS, ESCALATED, REFERRED, RESOLVED, CLOSED, CANCELLED
IN_PROGRESS    -> ESCALATED, REFERRED, RESOLVED, CLOSED, CANCELLED
ESCALATED      -> IN_PROGRESS, REFERRED, RESOLVED, CLOSED, CANCELLED
REFERRED       -> IN_PROGRESS, RESOLVED, CLOSED, CANCELLED
RESOLVED       -> CLOSED, CANCELLED
CLOSED / CANCELLED / EXPIRED -> (none)
```

Note: `assign()` and `escalate()` set status directly and bypass this table; `createReferral()` does not set `REFERRED`.

Public tracking maps the internal statuses to only four labels (`public-case-tracking.service.ts:7-38`): `NEW`/`PENDING` → `RECEIVED`, `PENDING_REVIEW`/`ACCEPTED`/`ESCALATED`/`REFERRED` → `UNDER_REVIEW`, `ASSIGNED`/`IN_PROGRESS` → `IN_PROGRESS`, terminal → `CLOSED`. `needsMoreInformation` is true only for `PENDING_REVIEW`.

### Consent, referrals, retention, redaction

- Intake rejects contact details without `consentToContact`; anonymous reports with contact are rejected. One `CONTACT_FOR_HELP` consent record is created automatically.
- A referral requires an active unexpired service **and** an active `GRANTED` `SHARE_WITH_SERVICE` consent; general contact consent is not enough. `note` in the referral DTO is accepted but discarded.
- Retention sweep (`POST /help-requests/retention/sweep`, admin only, `CASE_RETENTION_HOURS` default 168 h) expires open cases and wipes contact hash, summary and GPS. There is no scheduler.
- `redactText()` scrubs emails, long digit runs and common name patterns, then truncates (default 500 chars) before storing summaries, notes and reasons.
- Case codes are `SL-` + 16 uppercase hex chars from `randomBytes(8)`.
- `NotificationOutbox` is written only on escalation with `channel: STAFF`, `templateKey: CASE_ESCALATION_REVIEW`, no destination and no body. There is no consumer, retry worker or delivery adapter.

### Locations

No `/locations`, `/regions` or `/districts` endpoint and no location table. The same static dataset exists twice: `backend/src/location/tanzania-mainland-locations.ts` (31 regions / 193 districts, with a "keep in sync" comment) and `frontend/src/salama/data/tanzania-mainland-locations.json`. The backend validates intake against its TS copy; the web form renders its JSON copy. A separate 7-district legacy list exists in `frontend/src/salama/data/districts.ts` for the SMS/USSD simulator.

### Content and services

- `GET /content` only returns `APPROVED`, ordered by `publishedAt desc`, with `sourceName`/`sourceUrl` attribution. `language` is restricted to `sw`/`en` only on writes; `topic` is a free string.
- Service entries start inactive; `PATCH /admin/services/:id/verify` activates them. Public listing requires active + verified-at-past + not-expired. The web page fetches all and filters client-side by district/type.

---

## 4. Existing web frontend (patterns worth porting, and gaps)

- Routes: `/`, `/report`, `/help` (redirect), `/ai`, `/services`, `/organizations`, `/ussd`, `/track`, `/dashboard`, `/institutions`, `/officers/*`, plus server routes. `src/routeTree.gen.ts:152-176`.
- Public header (`components/public-header.tsx:13-25`) deliberately excludes staff/institutional links; officer routes exist only as direct URLs.
- i18n: custom typed dictionaries `src/i18n/en.ts` and `sw.ts`, key parity tests, `salama-line.language` in localStorage, explicit user switching, no device-language override, English fallback with warnings. This behaviour matches the mobile language requirement; the implementation will be rebuilt with i18next + react-i18next + Zustand persistence.
- Theme: `salama-line.theme` with `light | dark | system`, pre-paint bootstrap script, `theme-color` meta updates. Light theme was recently changed to a dim, muted pink (2026-11-20) — `styles.css:7-31`.
- Forms use `useState` + manual validation despite `react-hook-form`/`zod` being installed. The report form has a two-step location/details flow, explicit GPS consent, a receipt with copyable case code and a link to tracking.
- AI chat, service directory and tracking are live against the NestJS API. The local content bank (`src/salama/data/content.ts`) and sample services (`src/salama/data/services.ts`) are explicitly placeholders and are not used in live mode.
- No public referral UI (staff-only), no notification centre or preferences, no web quick-exit UI (only USSD `00`), no "my requests" list, no public user accounts.

---

## 5. Baseline verification performed

| Check | Result |
|---|---|
| `backend: npm test -- --runInBand` | **Pass** — 20 suites, 238 tests. |
| `frontend: npm test` | **Pass** — 206 tests (202 pass, 4 skipped) + 142 tests. One transient failure in `scripts/localization-ui.test.mjs` occurred on the first run (English text where Swahili was expected); a re-run and an isolated run passed. Likely shared browser-storage race in that browser test, worth fixing before adding mobile CI. |
| `frontend: npm run typecheck` | **Pass** (run during the preceding light-theme change). |
| `frontend: npm run build` | **Pass** (run during the preceding light-theme change). |
| Native builds / devices | **Not run** — no mobile project exists yet. |

---

## 6. Mobile requirement → backend reality

Legend: **Ready** = endpoint exists and fits the requirement. **Partial** = usable with limits. **Missing** = no backend support; client-only or new backend work required.

| Mobile feature | Status | Reality / consequence |
|---|---|---|
| Onboarding, language selection/persistence, Quick Exit, privacy screens, design system, navigation | Client-only | No backend dependency. Quick Exit cannot guarantee privacy; document platform limits. |
| Public user registration/login | **Missing** | `/auth/register` creates an inactive `RESPONDER`; `USER` role is unused. No public-user sign-in policy exists. **Blocking decision required.** |
| Forgot/reset password | **Partial** | Endpoints exist, but the token is never delivered and no mail/SMS/notification adapter exists. UI cannot honestly promise a working reset. |
| Logout / refresh / MFA / session revocation | **Partial / missing** | `tokenVersion` exists and reset/admin changes invalidate tokens, but there is no logout, refresh or MFA endpoint. 15 m access tokens require re-login. |
| Profile / language / notification preferences | **Missing** | No `PATCH /auth/me`, no preference fields, no preference API. Language must be device-local only. |
| Home screen | **Ready / client** | Can be assembled from existing public endpoints plus local state. |
| Submit support request, receive + copy reference | **Ready** | `POST /help-requests` and case code receipt. |
| Track request / status | **Ready** | `GET /case-tracking/:caseCode` with the four public statuses. |
| "My support requests" list | **Missing** | No owner relation on `HelpRequest`, no public list. Only per-code tracking is possible. |
| Verified services directory, search/filter by region/district | **Partial** | `GET /services` returns region/district per entry; filtering/search must be client-side. No dedicated location API. |
| Educational resources by category with search | **Partial** | `GET /content?language=...&topic=...` exists and is bilingual, but there is no topic catalogue endpoint and approved data must be seeded by staff. |
| Referral management for users | **Missing** | Referral list/create are staff-only. Public tracker explicitly excludes referrals. Need a consent-safe public referral view or accept "referral info in tracking only". |
| Notifications | **Missing server-side** | No push tokens, subscriptions, provider or dispatcher. Local Expo notifications with neutral wording are possible client-side; real server push needs new backend work. |
| Officers Portal | N/A | Must be entirely absent from mobile UI. Backend officer modules/tables/permissions stay untouched. |
| Offline awareness, timeouts, error states | Client-only | Existing web API client already establishes a 15 s timeout and an i18n error mapper to mirror. |

---

## 7. Known backend defects/drift to avoid inheriting

1. Root README describes a password-based seed that no longer exists (promotion-only now).
2. `CONTACT_HASH_SECRET` is conditionally required by runtime config but unconditionally required by `hashContact`, so intake with contact fails in local dev when unset.
3. Password-reset token is generated but never delivered.
4. `NotificationOutbox` has no consumer; escalation records are inert.
5. `ConsentPolicy` rows are not linked to runtime consent records (`consentPolicyId` stays null).
6. `Referral.serviceEntryId` has no FK, `status` never advances, and `note` is discarded.
7. AI knowledge admin approvals do not affect the JSONL knowledge loader used for answers.
8. Swagger disabled by default; most response shapes are inferred from Prisma `select`s.
9. `POST /admin/institutions` returns 403 for duplicate codes rather than 409; `UpdateInstitutionDto` cannot change `districtCode`/`code`.
10. Duplicate staff login history: frontend has two staff portals (`/officers` and `/institutions`); neither should influence mobile design.
11. Frontend localization browser test is order/storage-sensitive.

None of these were introduced by this assessment; they should be tracked, not silently "fixed" during the mobile build unless explicitly approved.

---

## 8. Next step

Phase 2 (Expo project setup) is blocked only on the decisions recorded in `docs/mobile/migration-plan.md`, section 2. No files under `backend/` or `frontend/` were changed for Phase 1; the only repository change is this documentation (plus the uncommitted light-theme pink adjustment from the preceding task).
