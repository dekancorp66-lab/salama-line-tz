# SalamaLine mobile — API integration

Companion to `docs/mobile/phase-1-assessment.md` and `docs/mobile/authentication.md`. All routes below are verified against the NestJS source; none were invented for this work.

---

## 1. Client layout

| File | Role |
|---|---|
| `mobile/src/api/config.ts` | Resolves `EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3000/api/v1`) and the 15 s timeout. No secrets in env. |
| `mobile/src/api/client.ts` | Single Axios instance: Bearer injection from `tokenStore`, 401 token removal + unauthorized handler, no response-body logging. |
| `mobile/src/api/tokenStore.ts` | `expo-secure-store` wrapper for the access token. |
| `mobile/src/api/endpoints.ts` | Typed public-content, services, help-request and case-tracking calls. |
| `mobile/src/api/authRequests.ts` | Pure, injectable auth request/response mapping for the verified auth endpoints. |
| `mobile/src/api/auth.ts` | Binds `authRequests` to the real client. |
| `mobile/src/api/aiRequests.ts` | Pure, injectable AI request/response mapping for the two verified AI endpoints. |
| `mobile/src/api/ai.ts` | Binds `aiRequests` to the real client. |
| `mobile/src/api/errors.ts` | Maps transport/HTTP status to translated `errors.*` keys. |

## 2. Endpoint inventory used by mobile

| Method | Path | Auth | Source of contract |
|---|---|---|---|
| GET | `/content?language=&topic=` | public | `ContentController` / `ApprovedContent` select |
| GET | `/services` | public | `ServicesController` public list |
| POST | `/help-requests` | public | `HelpRequestsController` public intake |
| GET | `/case-tracking/:caseCode` | public (throttled 8/min) | `PublicCaseTrackingController` |
| POST | `/auth/register/public` | public (throttled 5/min) | **Added in this work** |
| POST | `/auth/login` | public (throttled 10/min) | existing `AuthController` |
| GET | `/auth/me` | Bearer | existing `AuthController` / `JwtStrategy` |
| POST | `/auth/logout` | Bearer (throttled 10/min) | **Added in this work** |
| GET | `/ai/health` | public | `AiController` / `AiHealthResponseDto` |
| POST | `/ai/ask` | public (throttled 10/min) | `AiController` / `AskAiDto` |

Not used by mobile: staff `POST /auth/register`, password-reset endpoints, all admin routes, all staff case-management routes, all integration placeholders.

## 3. Conventions respected

- Global prefix `api/v1`; global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Mobile never sends extra fields (notably no `role`, `isActive` or institution data).
- Throttling from `@nestjs/throttler`; client surfaces 429 as `errors.rateLimited`.
- Auth is a Bearer access token only. There is no refresh endpoint, no cookie session and no token blocklist.
- `POST` endpoints return 201 by Nest default; the client does not depend on 200 vs 201.
- `GET /auth/me` returns `institutionId` but not `displayName`; login returns `displayName` but not `institutionId`. `AuthUser` types both as optional and the app never invents either field.
- AI requests send only `question`, `language` and at most the last six `context` turns. Each turn is clamped to the backend's 2,000-character limit. No provider key, model name, device identifier or personal field is sent by the mobile client.
- The mobile app has no LLM SDK. All AI answers come from the backend's verified `/ai/health` and `/ai/ask` contracts; the UI never invents advice or claims automatic emergency action.
- AI conversation text stays in screen memory only. It is not written to AsyncStorage, SecureStore, logs or analytics.

## 4. Error model

`apiErrorKey` is the single mapping point:

| Condition | Key |
|---|---|
| Timeout / abort | `errors.timeout` |
| No response | `errors.network` |
| 400 / 422 | `errors.validation` |
| 401 | `errors.unauthorized` |
| 403 | `errors.forbidden` |
| 404 | `errors.notFound` |
| 409 | `errors.conflict` |
| 429 | `errors.rateLimited` |
| 503 / 504 | `errors.unavailable` |
| Other | `errors.generic` |

`translateApiError(t, error)` returns the translated string. UI code never prints `error.message`, response bodies or headers. This avoids leaking confidential case data or internal backend detail.

## 5. Testing approach

`authRequests.test.ts` and `aiRequests.test.ts` inject a fake HTTP client to assert exact paths, bodies and response mapping without importing Expo native modules. AI tests cover the six-turn context limit, DTO-only request body and 429 propagation. `errors` tests assert status mapping and that a 401 rejection propagates safely. `themeStore.test.ts` covers persistence of the appearance choice using in-memory storage. Real backend integration was **not** exercised with a live server in this phase; live happy/sad-path QA, including the AI endpoints, remains outstanding.

## 6. Deliberate non-integrations

| Capability | Why not integrated |
|---|---|
| Password reset | Backend token has no delivery adapter. UI states unavailability. |
| Refresh token | No endpoint exists; do not fake one. |
| "My requests" history | No owner relation or list endpoint; case-code tracking only. |
| Referral list/status | No safe endpoint; neutral information only. |
| Server push / device tokens | No dispatcher or preference fields on `User`. |
| Notification preferences sync | No backend fields; preferences stay on-device and are labelled as such. |
| AI provider keys / mobile LLM SDK | Provider configuration and safeguards stay in the backend; mobile only calls the two verified endpoints. |
| AI conversation history | No backend persistence contract exists; clearing the screen discards the conversation. |
