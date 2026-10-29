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

Optional fields are `role` (`ADMIN`, `RESPONDER`, `CONTENT_REVIEWER`, or `PARTNER_ANALYST`) and `districtCode`. Only `wilbardmagaso777@gmail.com`, bootstrapped as the super administrator, can grant `ADMIN` access or change an existing administrator's access. Other administrators can approve non-admin staff. Do not include optional fields when the user should remain a `RESPONDER` without a district assignment. After a successful activation, the user can log in. Set `isActive` to `false` to revoke the account's access.
