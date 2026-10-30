# Architecture and Safeguarding Decisions

## Request flow

Channel adapter (web / future USSD / SMS / WhatsApp) → validated API request → consent and minimization rules → PostgreSQL → trained responder workflow. Outbound notifications must be implemented through provider adapters and a durable queue with retries, idempotency, dead-letter handling and operational monitoring before launch.

## Modules

- `auth`: staff accounts, JWT authentication.
- `content`: professional approval workflow; only approved content is public.
- `service-directory`: active verified service lookup.
- `help-requests`: consent decision record, case status lifecycle.
- `admin`: staff access management and privacy-conscious aggregate metrics.
- `integrations`: explicit channel adapter placeholders.
- `audit`: metadata-only audit event service.
- `database`: Prisma client lifecycle.
- `health`: liveness/readiness.

## Sensitive-data principles

1. Default to anonymous access for information and service lookup.
2. No name, age, raw phone number or message narrative in logs.
3. Consent is purpose-specific and versioned.
4. Only designated staff roles access case queues.
5. No automated reporting to family, police or authorities.
6. Never create free-form AI medical/legal/safeguarding advice.
7. Suppress low-count analytics; conduct formal re-identification assessment.
8. Delete or cryptographically erase contact data at closure according to the approved retention schedule.

## Production gaps

This project is not a substitute for an approved safeguarding operating model. Before real-world launch, implement provider signature validation, encrypted callback contact vault, case-level authorization, notification outbox/queue, escalation scheduler, deletion jobs, audit retention, MFA, monitoring, incident response, data-protection review and independent security assessment.
