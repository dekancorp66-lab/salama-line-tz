# SalamaLine Backend

NestJS + TypeScript REST API foundation for SalamaLine, a Swahili-first support platform. This codebase follows the proposal's key rules: approved information only, verified services only, consent before contact, a trained human responder, minimal data, anonymous reporting, and no automatic contact with family/police/authorities.

> **Important:** This is a substantial runnable backend starter, not a production-certified safeguarding service. Provider integrations, operational response protocols, legal/privacy review, independent security review, approved Swahili/English content, verified service data, and deployment secrets must be completed before serving real people. Do not use real cases or personal contact details during development.

## Included

- NestJS API, TypeScript, request validation and Swagger docs.
- PostgreSQL + Prisma schema and migration workflow.
- Staff registration/login with bcrypt hashes, JWT access tokens, role-based routes, inactive-by-default accounts.
- Health/readiness endpoints.
- Approved content publication workflow (draft until reviewed).
- Verified service directory (only active, not-expired entries returned).
- Consent-recorded help-request creation and staff case workflow.
- Admin user activation/role management and small-count suppression for a basic metric.
- Audit service, security headers, CORS allowlist, global rate limit.
- Docker Compose PostgreSQL, Dockerfile, test scaffold.
- USSD/SMS/WhatsApp adapter placeholders that explicitly report not configured rather than pretending to send messages.

## Requirements

- Node.js 20 LTS
- npm
- Docker Desktop (recommended) or PostgreSQL 16
- A secure secrets manager for deployed environments

## Run locally on macOS

1. Extract the ZIP and open the `SalamaLine_Backend` folder in VS Code.
2. In the VS Code terminal:

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

3. Open:
   - API: `http://localhost:3000/api/v1/health`
   - Database readiness: `http://localhost:3000/api/v1/health/ready`
   - Swagger: `http://localhost:3000/docs`

If migration fails, confirm Docker is running and the database URL in `.env` matches `docker-compose.yml`.

## Bootstrap the super administrator

Do not enable public self-registration as an administrator. The public registration endpoint creates an inactive `RESPONDER` account. Bootstrap the super administrator from a trusted operator terminal:

```bash
SEED_ADMIN_EMAIL=wilbardmagaso777@gmail.com
printf 'Super administrator password (14+ characters): '
read -r -s SEED_ADMIN_PASSWORD
printf '\n'
export SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD
npm run seed
unset SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD
```

The seed uses `DATABASE_URL` from `.env` and only bootstraps `wilbardmagaso777@gmail.com` as an active `ADMIN`. When run, it creates the account if needed or updates the existing account's password, role, and active status. Use a new password of at least 14 characters; the seed password is a reset credential for this account. Keep credentials out of source control and use a secure operator environment in deployments. The super administrator can approve staff accounts and grant `ADMIN` access to other registered accounts. Other administrators can approve non-admin staff, but cannot grant administrator access or change an administrator's access. The super administrator account cannot be deactivated or downgraded through the API.

## Activate registered staff accounts

1. Sign in as the bootstrapped administrator with `POST /api/v1/auth/login` and keep the returned access token private.
2. Register the staff member with `POST /api/v1/auth/register`. New accounts remain inactive and have the `RESPONDER` role; login is rejected until an administrator approves activation.
3. In Swagger (`/docs`) or an HTTP client, call `PATCH /api/v1/admin/users/{id}/access` with the administrator's bearer token and JSON body:

   ```json
   {
     "isActive": true
   }
   ```

   The `{id}` is the user ID returned by registration or listed by `GET /api/v1/admin/users`. The required `isActive` boolean activates or deactivates the account. Optional `role` and `districtCode` fields change access permissions and assignment respectively; omit them when only activating a responder. Only an active `ADMIN` can use this endpoint. Only the super administrator can grant `ADMIN` or change an existing administrator's access.

4. The staff member can now sign in with `POST /api/v1/auth/login`. Deactivating an account also prevents future logins and authenticated requests.

## API overview

Base prefix: `/api/v1`

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| GET | `/health/ready` | Public | Database readiness |
| POST | `/auth/register` | Public, rate-limited | Create inactive staff account |
| POST | `/auth/login` | Public, rate-limited | Staff login |
| GET | `/auth/me` | Authenticated | Current user |
| GET | `/content?language=sw&topic=wellbeing` | Public | Approved content only |
| POST | `/content` | Admin/content reviewer | Create draft content |
| POST | `/content/:id/review` | Admin/content reviewer | Approve or return to draft |
| GET | `/services?district=MBEYA&type=CLINIC` | Public | Active verified services |
| POST | `/help-requests` | Public, rate-limited | Create request and record consent decision |
| GET | `/help-requests` | Admin/responder | Open cases; responder scoped to assigned district |
| PATCH | `/help-requests/:id/status` | Admin/responder | Update case status |
| GET | `/admin/users` | Admin | Staff accounts |
| PATCH | `/admin/users/:id/access` | Admin | Activate/deactivate/change staff role |
| GET | `/admin/metrics` | Admin | Basic metrics with small case counts suppressed |
| GET | `/integrations/status` | Public | Provider configuration status |

Swagger at `/docs` provides interactive request examples.

## Safeguarding and privacy boundaries

- Never put names, case narratives, phone numbers, credentials, tokens or message bodies in logs or audit records.
- Public content endpoint returns `APPROVED` records only. A human professional must review content before publication.
- Directory entries must be verified by an accountable partner and kept current; do not seed invented services.
- Help requests do not automatically alert anyone. The operational responder queue, secure notification delivery, retry/escalation schedule and duty roster must be implemented and tested before launch.
- Contact details are rejected unless consent is explicitly granted. This baseline hashes an identifier for deduplication and does **not** retain a usable callback number. To support safe callbacks, implement envelope encryption with a managed key, consent-scoped access, strict retention, and deletion-on-closure. Do not simply store plaintext.
- No automatic contact with family, police or authorities. No crisis decisions or diagnoses by AI.
- Small-count suppression in the admin metrics is only a baseline; perform a re-identification review before releasing analytics.
- Configure HTTPS, secret rotation, database encryption/backups, alerting, incident response, retention/deletion jobs, access reviews and independent penetration testing before production.

## Before launch checklist

- [ ] Obtain child safeguarding, clinical, legal and data-protection review for Tanzania.
- [ ] Approve Swahili and English content and set review expiry/ownership.
- [ ] Verify all service directory entries with named partners.
- [ ] Define staffed responder hours, safe contact scripts, district routing, acknowledgement SLAs and escalation protocol.
- [ ] Implement and test real SMS/USSD/WhatsApp adapters, signed webhook verification, replay protection and delivery receipts.
- [ ] Implement encrypted contact storage only if operationally required and consented to; test deletion at closure.
- [ ] Add case assignment authorization, responder access auditing, CSRF protections if cookie auth is added, stronger auth/MFA for staff and account lockout controls.
- [ ] Add comprehensive unit/integration/e2e tests and load/security testing.
- [ ] Configure production CORS, secrets, backups, monitoring, incident handling and data retention.
- [ ] Conduct safety testing with relevant partners and young people without exposing real personal data.

## Design note

This repository intentionally refuses to pretend that a third-party channel is working before credentials and provider-specific verification are implemented. It is safer to ship explicit adapters and a launch checklist than to silently drop or misroute a young person's request.
