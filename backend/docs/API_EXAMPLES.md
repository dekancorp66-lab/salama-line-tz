# API examples

## Create a help request

`POST /api/v1/help-requests`

```json
{
  "topic": "child-marriage-concern",
  "districtCode": "MBEYA",
  "channel": "WEB",
  "consentToContact": false,
  "anonymousReport": true
}
```

The response returns a random case code. The API does not send an alert yet. A real deployment must have a staffed queue and verified notification adapter.

## Track a case (public)

`GET /api/v1/case-tracking/{caseCode}`

Example: `GET /api/v1/case-tracking/SL-CC723587`

No account or bearer token is required. The reference is the `caseCode` printed on the submission receipt (for example `SL-CC723587`); internal database IDs are not accepted and are rejected with `400`. The endpoint is rate limited to 8 lookups per minute.

The response contains only public progress information:

```json
{
  "caseCode": "SL-CC723587",
  "submittedAt": "2026-11-17T18:48:16.353Z",
  "status": "RECEIVED",
  "lastUpdatedAt": "2026-11-17T18:50:42.591Z",
  "progressUpdates": [
    { "label": "Help request received", "at": "2026-11-17T18:48:16.353Z" }
  ],
  "needsMoreInformation": false
}
```

It never returns case details, contact information, district, officer identities, notes, referrals, or safeguarding records. `404` means the reference was not found. This tracker does not contact emergency services.

## List approved content

`GET /api/v1/content?language=sw`

Only records with status `APPROVED` are returned.

## Staff login

`POST /api/v1/auth/login`

```json
{
  "email": "responder@example.org",
  "password": "your-password"
}
```

Use the returned bearer token for protected staff routes. Public registration creates an inactive account and does not grant access automatically.

## Activate a registered user

Only an active administrator can call `PATCH /api/v1/admin/users/{id}/access`. Obtain the administrator bearer token by logging in, then send the registered user's ID and the required `isActive` property:

```http
PATCH /api/v1/admin/users/cuid-from-registration/access
Authorization: Bearer <administrator-access-token>
Content-Type: application/json
```

```json
{
  "isActive": true
}
```

Optional fields are `role` (`SUPER_ADMIN`, `ADMIN`, `RESPONDER`, `CONTENT_REVIEWER`, `CONTENT_MANAGER`, `SERVICE_MANAGER`, `AUDITOR`, or `PARTNER_ANALYST`) and `districtCode`. The dedicated `SUPER_ADMIN` role is the source of truth; the legacy email remains only as a compatibility fallback for accounts bootstrapped before that role existed. Only a super administrator can grant or modify administrative access. Other administrators can approve non-admin staff. Do not include optional fields when the user should remain a `RESPONDER` without a district assignment. After a successful activation, the user can log in. Set `isActive` to `false` to revoke the account's access.

## Case management (staff only)

All routes below require a bearer token. A responder may only access cases in their own district that are unassigned or assigned to them; administrators may work across districts.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/help-requests/:id` | Minimized single-case view (never returns stored contact identifiers) |
| `PATCH` | `/api/v1/help-requests/:id/status` | Validated lifecycle transition |
| `POST` | `/api/v1/help-requests/:id/assign` | Assign or reassign to an active responder of the same district |
| `GET` / `POST` | `/api/v1/help-requests/:id/notes` | Read / add redacted, metadata-only case notes |
| `POST` | `/api/v1/help-requests/:id/escalate` | Record an escalation (metadata only; never contacts anyone automatically) |
| `POST` | `/api/v1/help-requests/:id/consent/grant` | Record a specific, versioned consent grant for a purpose |
| `POST` | `/api/v1/help-requests/:id/consent/revoke` | Revoke a specific consent purpose and wipe contact identifiers where applicable |
| `GET` / `POST` | `/api/v1/help-requests/:id/referrals` | List / create referrals to active verified services, only with valid consent |
| `POST` | `/api/v1/help-requests/retention/sweep` | Administrator only: expire aged open cases and wipe their contact data |

Example assignment:

```json
{ "responderId": "cuid-of-responder", "reason": "duty roster" }
```

Referrals require an active `SHARE_WITH_SERVICE` consent grant; general contact consent is not sufficient. Free-text `concernSummary` on intake and `note` on staff notes are redacted server-side (emails, phone numbers, and common name patterns) and truncated before persistence. Redaction is defense in depth, not a guarantee: staff must still enter case metadata only. No endpoint contacts a family, police, or any authority automatically.
