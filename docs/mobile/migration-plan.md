# SalamaLine mobile — migration plan

Companion to `docs/mobile/phase-1-assessment.md`. This plan covers Phases 2–11 of the requested implementation.

**Status:** Phase 1 (inspection), Phase 2 setup, Phase 3/4 foundation, the mandatory Quick Exit and permanent-language work, and **Phase 5 authentication / Phase 8 hardening are implemented**. D1/D2/D3 below are resolved in favour of the minimal additions actually shipped. This does **not** mean the whole mobile application is complete: Phase 6 module polish, Phase 10 on-device QA and Phase 11 store-build preparation remain. See `docs/mobile/quick-exit-and-language.md` for Phase 4 verification and `docs/mobile/authentication.md`, `docs/mobile/api-integration.md` and `docs/mobile/notifications.md` for the new architecture. The web frontend was not modified for this work (the earlier dim-pink light theme change in `frontend/` is separate).

---

## 1. Guiding constraints

1. Keep `backend/` (NestJS, Prisma, PostgreSQL, REST, Swagger) and `frontend/` unchanged except for explicit, approved additions needed by mobile.
2. Never invent endpoints. Every integration must map to a route verified in Phase 1.
3. No Docker, Firebase, Supabase or replacement backend.
4. Public mobile UI must contain no Officers Portal, officer login, officer registration, officer tabs or admin entry points.
5. Privacy first: minimum data, no sensitive logs, no sensitive notification previews, no claims of guaranteed anonymity or automatic emergency contact.
6. Language is user-controlled and persistent; never device-driven, never API-driven.
7. Quick Exit is client-side and must be honest about its limitations.

---

## 2. Decisions required before Phase 2

These are genuine product/architecture decisions; implementation must not guess.

### D1 — Public user authentication model (resolved: A)

**Decision:** public registration creates an **active, non-privileged `USER`**; privileged accounts remain super-admin provisioned and explicitly approved. Implemented as:

- `POST /api/v1/auth/register/public` reuses `RegisterDto` (email, password, displayName only) and creates `UserRole.USER`, `isActive: true` with an audited `AUTH_PUBLIC_REGISTER` event.
- The global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` rejects any injected `role` field; the service also hardcodes the role so internal callers cannot escalate.
- Existing `POST /auth/register` (inactive `RESPONDER`) and the admin officer provision/approve flow are unchanged. There is no officer/admin surface in the public mobile app.
- Email is required by the existing DTO contract; `displayName` is a self-chosen display label only. No age or identity data is collected at registration.

Ordinary users may use all public features without an account; an account is optional and never required for confidential support.

### D2 — Scope of backend additions (resolved: minimal)

Only two additions were made, both following existing NestJS conventions (DTO → throttled controller → service → audit): `POST /auth/register/public` (D1) and guarded `POST /auth/logout` (increments `tokenVersion`). **No Prisma schema change, no new module, no second backend, no duplicate business logic.**

| Gap | Decision / shipped behaviour |
|---|---|
| Password reset delivery | Not shipped. The backend creates a token but has no delivery adapter; the sign-in screen states recovery is unavailable and points to Support instead of presenting a fake flow. |
| Logout / session revocation | Shipped `POST /auth/logout`, guarded by `JwtAuthGuard`, incrementing `tokenVersion`. It revokes all currently issued tokens for that account (there is no per-device session model). |
| Refresh tokens | Not shipped. No refresh endpoint exists. Access tokens expire after `JWT_ACCESS_TTL` (default 15 m); the client signs the user out on 401 and requires re-login. No fake refresh flow was added. |
| Public user profile/preferences | Device-local only. `GET /auth/me` is used for identity verification on restore; no language/notification fields were added to `User`. |
| "My requests" | Not shipped. Case-code tracking remains the only request access path; no owner relation or history list was invented. |
| Public referral view | Not shipped. Neutral referral information only; no referral list or status endpoint was invented. |
| Location API | Not shipped. The canonical static region/district dataset remains bundled in the client. |
| Push notifications | Not shipped. Local-permission UI and client preferences only; no device-token registration or dispatcher was added. |

### D3 — Notification scope (resolved: a)

Local-only, privacy-first notifications. Preferences are persisted on-device with private defaults (everything off), categories are configurable, device permission requires explicit opt-in, and the UI states plainly that server push is unavailable in this build. No request details, referrals, names or contact details appear in any notification text or preview. See `docs/mobile/notifications.md`.

---

## 3. Phase 2 — React Native + Expo setup

**Goal:** runnable TypeScript Expo app with no business screens yet.

- Create `mobile/` with Expo Router, TypeScript strict mode, NativeWind (or StyleSheet tokens if NativeWind conflicts), TanStack Query, Zustand, React Hook Form, Zod, Axios, `expo-secure-store`, `expo-notifications`, i18next/react-i18next.
- Environment config: `mobile/.env.example` with only `EXPO_PUBLIC_API_BASE_URL`; never ship secrets. Runtime base URL resolved in one client module.
- `app.json` / `eas.json` with separate dev/preview/production profiles; no signing secrets checked in.
- Central Axios client: base URL, timeout (15 s), auth header injection, response error normalisation, connectivity awareness. No endpoint invented.
- Verification: `npx tsc --noEmit`, `npm run lint` (if configured), Expo start, app renders a placeholder shell on a dev client/simulator. Document actual commands and results.

## Phase 3 — Design system and navigation

- Tokens derived from the app's calm light palette (including the dim pink light theme from `frontend/src/styles.css`), optional dark theme, spacing scale, typography, touch targets ≥44 pt.
- Reusable components: `Card`, `Button`, `TextField`, `SelectField`, `SearchField`, `Skeleton`, `EmptyState`, `ErrorState`, `StatusBadge`, `ScreenHeader`, `SafetyBanner`, `QuickExitButton`.
- Tab navigator: **Home, Learn, Support, Requests, Profile**. Additional stack screens: service detail, request detail/receipt, referral detail/info, notifications, settings, language settings, privacy, neutral Quick Exit destination.
- No Officers Portal route, link, button, tab or shortcut anywhere.
- Handle Android hardware back explicitly (`backBehavior`, custom handlers on sensitive screens).
- Verification: navigate every tab and stacked screen; no officer surface reachable; no layout overflow at 360×800 and 390×844.

## Phase 4 — Internationalization and persistence

- `mobile/src/i18n/index.ts`, `locales/en.json`, `locales/sw.json`; central keys for all UI text, form labels, validation messages, error states and notification text.
- Zustand persisted store for `language` using Expo SecureStore/AsyncStorage as appropriate; explicit user-only changes.
- Rules: no device-language fallback when a preference exists; never override language from API responses; navigation labels and form validation respect the selected language.
- Port the web app's key-parity tests with i18next: all keys present and non-empty in both locales.
- Verification: switch language, navigate all tabs, restart app, log out/in, switch OS language; selected language persists.

## Phase 5 — Onboarding and authentication (implemented)

- Onboarding (Phase 4): welcome, introduction, support services, language selection, privacy/safety; skippable after first run. Kept unchanged.
- Implemented screens: `app/auth/sign-in.tsx`, `app/auth/register.tsx`, protected `app/account.tsx`. No forgot-password or reset screen: the backend has no delivery path, so the sign-in screen explains this instead of presenting a non-functional flow.
- Forms: React Hook Form + Zod with translated messages; client bounds mirror the NestJS DTOs (email, password 12–128, displayName 2–80). Server errors are shown only via `translateApiError`; raw server text is never rendered or logged.
- Tokens: SecureStore only via `src/api/tokenStore.ts`. Session restore checks the stored token with `GET /auth/me` and never trusts locally cached roles. A 401 removes the token and clears in-memory identity through `setUnauthorizedHandler`.
- Roles: `USER` is the only public role. Staff roles produce a neutral "use the approved staff workspace" notice and no extra mobile capability.
- Verification executed: typecheck, 56 unit tests, iOS and Android Metro bundles, backend Jest suite. On-device happy/sad paths are **not yet executed** (see QA checklist).

## Phase 6 — Home and modules

- Home: welcome, quick support, learning entry, report concern, services, my requests/referral info, notifications, profile/settings.
- Support request: category, minimal details, region/district selection from the canonical dataset (or `GET /locations` if approved), optional contact with explicit consent, optional GPS with separate consent, submit to `POST /help-requests`, show/copy case code, deep-link to tracking.
- Requests: tracking by case code via `GET /case-tracking/:caseCode`, four backend statuses only, pull-to-refresh, no invented fields.
- Services: `GET /services`; client-side search/filter by type, region, district from returned data; dial/address/hours/languages from safe public fields.
- Learn: `GET /content?language=<pref>&topic=...`; category tabs and search; show `sourceName`/`sourceUrl`; graceful empty state when no approved content is seeded.
- Referrals: honest, consent-safe information only; no fabricated referral status or list.
- Verification: submit → copy code → track; filter services; read content in both languages; offline and error states.

## Phase 7 — Quick Exit and safeguarding

- Prominent but discreet control on Home, Learn, Support form, Requests/Tracking and any sensitive detail screen.
- One press: navigate (via router reset/replace) to a static neutral screen with no request data, referral history, personal info or learning content; clear sensitive route params/state where appropriate.
- Android hardware back from the neutral screen must not restore the sensitive screen; handle app backgrounding (blur overlay in recent-app preview where the platform permits).
- No automatic logout; no claim that the app closes or that privacy is guaranteed.
- Verification matrix: Home, Learn, request form, tracking/request detail, referral/info, app switch and return; Android back; iOS behaviour documented.

## Phase 8 — Backend integration hardening (implemented)

- Central API modules: `src/api/endpoints.ts` (public content/services/help requests/case tracking) and `src/api/auth.ts` (`authRequests.ts` factory) bound to one Axios client (`src/api/client.ts`).
- Typed request/response contracts mirror the verified NestJS DTOs/selects; no endpoint is invented.
- Auth headers, SecureStore token, 401 interceptor, 15 s timeout and translated error mapping (`errors.*`, including 409 → `errors.conflict`) are in place. There is no refresh endpoint; 401 means local sign-out and re-login.
- No mock/fake API responses in app code. Test fakes exist only in unit tests with injected clients.
- Verification executed: typecheck, unit tests for API error mapping and request shaping, Expo bundles for both platforms. Manual happy/sad paths against a real backend URL remain outstanding.

## Phase 9 — Privacy, security, notifications

- Secure token storage; no sensitive logs; no sensitive notification previews; permission flow documented before requesting notification permission.
- Consent wording at request time; clear statements about what is stored and what is not automatic.
- Local notifications only if D3(a): neutral text, deep links to neutral screens, respecting user preferences.
- Verification: inspect logs/notification centre for sensitive content; permission denied path; deep link from notification.

## Phase 10 — Testing and QA

- Unit tests: i18n persistence, validation schemas, API error mapping, Quick Exit navigation reducer, status mapping.
- Component/integration tests with the project's available test runner.
- Manual device/simulator matrix for auth, language, Quick Exit, request submission, tracking, services, content and app switching.
- Run and record: TypeScript check, unit tests, Expo doctor/build validation where available. **Do not claim a test passed unless executed.**

## Phase 11 — Android and iOS build preparation

- `eas.json`, `app.json` metadata, privacy manifests and App Store privacy disclosures reflecting actual data collection.
- Android: EAS build instructions, keystore handling outside source control, `android.permission` review (notification, location only if used).
- iOS: EAS build instructions, signing prerequisites, Info.plist usage strings for notifications/location, App Store review notes explaining Quick Exit limitations.
- Produce final README, `.env.example`, testing report, completed-feature list and limitations list. No store submission is implied.

---

## 4. Verification gates (per phase)

| Phase | Gate | Status at this checkpoint |
|---|---|---|
| 2 | TypeScript check passes; Expo app launches; API base URL configurable. | Typecheck and bundles pass; interactive launch not re-run here. |
| 3 | All routes reachable; no officer entry points; no overflow at small viewport. | Route files/stack entries present; no officer surface; visual viewport check not executed. |
| 4 | Both locales complete; language survives restart/login/OS-language change. | Key parity tests pass; on-device restart/OS-language check not executed in this phase. |
| 5 | Auth happy/sad paths pass in both languages; SecureStore used. | Pure logic/validation tests pass; SecureStore code reviewed; device happy/sad paths not executed. |
| 6 | Request → reference → tracking works; services and content render real API data. | Existing implementation preserved; live backend matrix not executed in this phase. |
| 7 | Full Quick Exit matrix passes; no sensitive content on neutral screen/back stack. | Unit tests pass; device matrix covered in `quick-exit-and-language.md` limitations. |
| 8 | No invented endpoints; error/offline states verified against real API. | Request shaping/error mapping tests pass; live API verification outstanding. |
| 9 | No sensitive data in logs or notification previews; permissions handled. | Preference tests pass and text reviewed; device notification centre not inspected. |
| 10 | All executed tests recorded with results; failures fixed. | Executed results recorded in the completion report; on-device QA not executed. |
| 11 | Build configs and docs complete; limitations explicitly listed. | Docs updated; EAS/store submission not prepared. | |

---

## 5. Explicit non-goals for this migration

- Rewriting NestJS modules, Prisma schema, permissions or officer functionality.
- Adding Firebase/Supabase or any replacement backend.
- Using Docker for the mobile app.
- Inventing endpoints, referral statuses, "my requests" data, or automatic emergency contact.
- Claiming Quick Exit guarantees privacy, closes the app, or that SalamaLine contacts authorities automatically.
- Shipping untranslated interface strings or a non-functional password-reset flow as if complete.
