# SalamaLine mobile — authentication

Companion to `docs/mobile/migration-plan.md` and `docs/mobile/api-integration.md`. This document describes the Phase 5 authentication foundation that is implemented in this repository. It does **not** claim that on-device QA has been performed.

---

## 1. Model and decisions

| Topic | Decision |
|---|---|
| Ordinary users | Public self-registration creates an **active `USER`** account. An account is optional; all public features remain usable without one. |
| Officers / administrators | **No public or mobile path.** Privileged accounts are provisioned by a super admin through the existing admin officer flow and explicitly approved there. |
| Self-assigned roles | Impossible by construction: `/auth/register/public` accepts only the three fields of `RegisterDto`; the global validation pipe rejects extra keys such as `role`, and the service hardcodes `UserRole.USER`. |
| Authorization | Server-side only. Mobile role helpers choose neutral labels/notices; they never unlock features. |
| Password recovery | **Not available.** The backend generates a reset-token hash but has no delivery adapter. The sign-in screen says so and points to Support instead of presenting a fake reset flow. |
| Refresh tokens | **Not available.** Access tokens expire after `JWT_ACCESS_TTL` (default 15 m). On 401 the app clears the session and requires sign-in again. |

## 2. Endpoints used

All paths are relative to `EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3000/api/v1`).

| Purpose | Endpoint | Auth | Request | Response used |
|---|---|---|---|---|
| Register | `POST /auth/register/public` | public | `{ email, password, displayName }` | `user` (id, email, displayName, role, isActive, createdAt) |
| Sign in | `POST /auth/login` | public | `{ email, password }` | `accessToken`, `tokenType`, `expiresIn`, `user` |
| Restore session | `GET /auth/me` | Bearer | — | `user` (id, email, role, districtCode, institutionId) |
| Sign out | `POST /auth/logout` | Bearer | — | `{ message }` |

`POST /auth/register` (staff registration, inactive `RESPONDER`) is deliberately **not** used by mobile.

## 3. Implementation map

| Concern | File | Behaviour |
|---|---|---|
| Request contracts | `mobile/src/api/authRequests.ts` | Pure factory: normalizes email, sends only DTO fields, maps responses. Injected client makes it testable without native modules. |
| Bound API | `mobile/src/api/auth.ts` | Binds the factory to the real Axios client. |
| Token storage | `mobile/src/api/tokenStore.ts` | Access token in `expo-secure-store` only; never AsyncStorage, never logged. |
| 401 handling | `mobile/src/api/client.ts` | Removes the token and calls the registered unauthorized handler. |
| Session restore | `mobile/src/auth/session.ts` | Reads the token, verifies with `/auth/me`, clears the token on any verification failure, and never trusts a cached role. |
| In-memory state | `mobile/src/auth/authStore.ts` | `user` + `status` (`unknown`/`anonymous`/`authenticated`); not persisted. |
| Orchestration | `mobile/src/auth/AuthProvider.tsx` | Restore on mount, sign-in, register-then-sign-in, sign-out (always clears locally), registers the 401 callback. |
| Route guard | `mobile/src/auth/ProtectedRoute.tsx` | Loading while `unknown`, redirect to `/auth/sign-in` when anonymous, render otherwise. Applied to `app/account.tsx` only. |
| Role helpers | `mobile/src/auth/roles.ts` | Neutral label selection; `USER` ≠ staff; privileged roles get a notice, not capabilities. |
| UI | `mobile/app/auth/*`, `mobile/app/account.tsx`, `mobile/app/(tabs)/profile.tsx` | Forms with loading/success/failure states; sign-in/create/account/sign-out actions. |
| Validation | `mobile/src/schemas/authSchema.ts` | Zod bounds mirror the backend DTOs; messages translated at build time. |

## 4. Flows

### Registration
1. User chooses display name, email, password and confirmation.
2. Client Zod validation runs first (email format, password 12–128, display name 2–80, passwords match).
3. `POST /auth/register/public` creates an active `USER`.
4. The app signs in with the same credentials to obtain a token, then navigates to Home.
5. Duplicate email (409) is shown as `errors.conflict`; no password or token is logged.

### Session restore
1. `AuthProvider` sets `status = unknown` and reads the SecureStore token.
2. If no token → `anonymous`. If a token exists, `GET /auth/me` supplies the identity.
3. Any failure (401/403/5xx/offline/malformed response) clears the token and yields `anonymous`.
4. Sensitive account routes show a loading state until this finishes.

### Sign-out
1. `POST /auth/logout` increments `tokenVersion` on the backend, revoking issued tokens.
2. The token is removed from SecureStore and in-memory identity is cleared **even if the server call fails**.

**Limitation:** there is no per-device session model, so logging out revokes all tokens for that account. A later Phase would need a session table to support per-device sessions.

## 5. Security notes

- Least privilege: only `USER` can be created publicly; role is server-assigned.
- Passwords and tokens never enter AsyncStorage, logs, audit metadata or notification text.
- Server error bodies are never rendered directly; only translated keys are shown.
- Auth failures are deliberately generic ("please sign in again" / "check the highlighted fields") to avoid account enumeration.
- Quick Exit is unaffected: it never signs the user out and never reads credentials.

## 6. Verification performed

`npm run typecheck`, `npm test` (56 passing, including auth request/validation/session/role tests), `npx expo export --platform ios` and `--platform android`, plus the backend Jest suite. See the completion report for exact counts and for what was **not** executed (device/simulator/native/physical-device QA).
