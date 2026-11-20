# Quick Exit and permanent language preference — mobile implementation

Companion to `docs/mobile/phase-1-assessment.md` and `docs/mobile/migration-plan.md`.
Both features are **client-only**. No NestJS, Prisma, database or web frontend code was changed for them.

---

## 1. Quick Exit / Quick Move

### Implementation

| Concern | Where | Behaviour |
|---|---|---|
| One-press control | `mobile/src/components/QuickExitButton.tsx` | A single `Pressable` with a 44 dp touch target, exposed from `ScreenHeader` on every sensitive screen. No menu or extra tap is needed. |
| Sensitive screen coverage | `app/(tabs)/*.tsx`, `app/content/[id].tsx`, `app/services.tsx`, `app/referral-info.tsx`, `app/settings/*.tsx`, `app/notifications.tsx`, `app/privacy.tsx` | All use `ScreenHeader`, which renders the Quick Exit button by default (`showQuickExit` defaults to `true`). The neutral screen is the only screen without it. |
| Immediate state change | `mobile/src/store/safetyStore.ts`, `mobile/src/hooks/useQuickExit.ts` | `triggerQuickExit()` is called first, so the root navigator drops sensitive routes in the same React commit. |
| History clearing | `mobile/src/navigation/quickExit.ts`, `mobile/app/_layout.tsx` | `buildNeutralResetAction()` produces `{ index: 0, routes: [{ name: 'neutral' }] }`. The root `Stack` also conditionally renders *only* the neutral screen while Quick Exit is active. No sensitive route remains reachable through navigation history. |
| Android hardware back | `mobile/app/neutral.tsx` | `BackHandler.addEventListener('hardwareBackPress', () => true)` keeps the user on the neutral screen. `predictiveBackGestureEnabled: false` is set in `app.json`. |
| Returning to the app | `mobile/app/neutral.tsx`, `mobile/app/_layout.tsx` | Explicit "Return to SalamaLine" press calls `returnToApp()`, which clears the in-memory flag and resets to a fresh `index` stack. No stale sensitive state is restored. |
| Background / app switching | `mobile/src/hooks/useAppState.ts`, `mobile/src/components/PrivacyOverlay.tsx` | When `AppState !== 'active'`, a full-screen neutral overlay covers the app so sensitive content is not visible in recent-app previews. It is removed on return to the foreground. |
| Notification previews | `mobile/app/notifications.tsx`, `mobile/app.json` | Only neutral local-reminder copy exists; no request, referral or personal detail is ever composed into a notification. No push payload handler renders sensitive content, and notification deep links land on the normal stack (which applies onboarding redirect), not on a request screen. |
| Session | `mobile/src/hooks/useQuickExit.ts`, `mobile/src/api/tokenStore.ts` | Quick Exit never removes the stored token and never calls a logout endpoint. Sign-out is a separate, explicit user action (not yet implemented — see D1/D2). |
| Honest wording | `mobile/src/i18n/locales/{en,sw}.json` → `quickExit.limitation` | Both languages state that Quick Exit moves the user away from sensitive screens and **does not close the app or guarantee complete privacy**. |

### Verification matrix

| Scenario | Status | Evidence |
|---|---|---|
| Quick Exit from home | Covered by shared `ScreenHeader` + reset action | Code path review; `buildNeutralResetAction` unit test |
| Quick Exit from educational content (list and detail) | Covered — `app/(tabs)/learn.tsx` and `app/content/[id].tsx` both use `ScreenHeader` | Code path review; `isSensitiveRoute('content/[id]')` unit test |
| Quick Exit from confidential support request screen | Covered — `app/(tabs)/support.tsx` uses `ScreenHeader` on both the form and receipt views | Code path review |
| Quick Exit while viewing referral information | Covered — `app/referral-info.tsx` uses `ScreenHeader` | Code path review |
| Android back button after Quick Exit | Blocked on the neutral screen | `BackHandler` in `neutral.tsx`; config in `app.json` |
| Returning after switching apps | Overlay applied on `AppState` change, removed on foreground | `useAppState.ts` + `PrivacyOverlay.tsx` |
| No sensitive route in history | Enforced by single-route reset and conditional Stack | Unit tests on `buildNeutralResetAction` / `buildReturnResetAction` |

---

## 2. Permanent, user-controlled language preference

### Implementation

| Concern | Where | Behaviour |
|---|---|---|
| Centralised resources | `mobile/src/i18n/locales/en.json`, `sw.json` | Identical flat key sets; every screen, button, label, placeholder, validation message, error, notification string and privacy notice reads through `t(...)`. |
| Initialisation | `mobile/src/i18n/index.ts` | Starts from the documented default `en` with `fallbackLng: 'en'`. It deliberately contains **no** `Localization`, `getLocales`, `getLocale` or device locale API call. |
| Persistent store | `mobile/src/store/languageStore.ts` | Zustand + `persist` on AsyncStorage under `salamaline.language`. `setLanguage` is the only mutation path and validates the value against `['en', 'sw']`. Language is not a secret, so AsyncStorage (not SecureStore) is appropriate. |
| Hydration before UI | `mobile/src/providers/I18nProvider.tsx` | Waits for persist hydration, applies the saved preference with `i18n.changeLanguage`, then renders children. No device setting is consulted. |
| Onboarding selection | `mobile/app/onboarding/language.tsx` | The user picks English or Kiswahili and presses "Use this language" — the explicit confirmation is the only onboarding mutation. |
| Dedicated settings screen | `mobile/app/settings/language.tsx` | Settings → Language → choose → Confirm. Selection is local state until Confirm; navigating away does not change the saved language. |
| No external override | `mobile/src/api/*`, navigation code | No API response, navigation event, module open or screen change calls `setLanguage`. The backend is never sent or asked for a locale. |
| Tab and navigation labels | `mobile/app/(tabs)/_layout.tsx` | Tab titles are translated with `t('nav.*')` and re-render on language change. |
| Form validation | `mobile/src/schemas/supportSchema.ts` | The Zod schema is built with translated messages, so validation errors follow the selected language. |
| API/error messages | `mobile/src/api/errors.ts` | HTTP/network failures map to `errors.*` translation keys, never to server English strings. |
| Dates | `mobile/app/(tabs)/requests.tsx` | Formatting uses an explicit `sw-TZ` / `en-TZ` locale derived from the saved preference, not the device locale. |

### Verification matrix

| Scenario | Status | Evidence |
|---|---|---|
| English stays English across all modules | Covered | Single i18n instance; parity test; source scan for locale APIs |
| Kiswahili stays Kiswahili across all modules | Covered | Same; all values non-empty and distinct for key labels |
| Selection survives restart | Covered | `languageStore` test creates a second store from the same persisted storage and reads `sw` |
| Only explicit user action changes language | Covered | `setLanguage` only called from onboarding Confirm and settings Confirm; invalid values ignored |
| No mixed-language interface | Covered | Flat key parity enforced by test; validation messages tested in both languages |
| Device language cannot override | Covered | Source scan test forbids locale APIs in i18n/store/provider |

---

## 3. Verification actually executed

Run from `mobile/`:

- `npm run typecheck` — passed (no errors).
- `npm test` — 22 tests passed, 0 failed. Covers key parity, non-empty translations, no device-locale API, persistence/restart, invalid values, Quick Exit reset routes, sensitive-route classification, validation language and case-code normalisation.
- `npx expo export --platform ios` — bundled successfully (1455 modules, Hermes bytecode).
- `npx expo export --platform android` — bundled successfully (Hermes bytecode).
- Backend contract review: `GET /content`, `GET /services`, `POST /help-requests`, `GET /case-tracking/:caseCode` and the `/api/v1` prefix were checked against the NestJS controllers, DTOs and services. No invented endpoints.

**Not executed:** simulator/dev-client run, Android emulator run, native `eas build`, and device-level UI automation. The matrices above are code-path verification plus unit tests, not a claim of on-device QA.

---

## 4. Documented limitations

1. **OS snapshot timing.** `PrivacyOverlay` reacts to `AppState` changes in JavaScript. On some Android/iOS builds the OS may capture the recent-app snapshot before React commits the overlay. For guaranteed masking, a native solution (Android `FLAG_SECURE`, iOS snapshot-blur on `applicationWillResignActive`) is required. This is intentionally not claimed as complete privacy — the UI says so explicitly.
2. **No native app-close.** Quick Exit never calls `exit`, `BackHandler.exitApp` or any process kill. It only navigates to a neutral screen and clears history.
3. **Notification delivery is local-only.** No device-token registration or server push dispatcher exists (D3). Because no push payload is rendered, there is currently no server-controlled preview content to leak; this must be preserved if push is added later.
4. **Language is local-only by design.** Preferences are not synced to a profile or sent to the API. A user who reinstalls the app returns to the default `en` until they choose again. This follows the "user-only changes" requirement; cross-device sync would need explicit approval (D2).
5. **Incoming API content language.** `GET /content` is requested with the saved language, so returned articles match the UI. Any future endpoint that returns free text (for example a referral note) must carry a language tag or be translated before display; today the app never displays such server prose.
6. **Auth remains deferred.** No login, logout or account screens are wired yet (D1/D2/D3). Quick Exit therefore does not interact with a session, and "no auto-logout" is trivially satisfied.
7. **Location consent.** The support form sends structured region/district IDs from the bundled canonical dataset and always sets `locationConsentGiven: false`; no GPS is collected.
8. **Channel value.** The backend has no `MOBILE` channel, so intake uses the existing `WEB` enum value. This is a backend modelling gap, documented rather than changed.

---

## 5. Manual QA checklist (to be run on devices before release)

1. From Home, Learn, a content article, Support (form and receipt), Services, Referral information, Notifications and Settings, press Quick Exit once — each must show only the neutral screen, with no request/reference/referral text.
2. Press the Android hardware back button and an iOS back gesture on the neutral screen — the app must stay on the neutral screen.
3. Press "Return to SalamaLine" — the app must open at a fresh home/index stack with no back stack into the previous sensitive screen.
4. Background the app from each sensitive screen, then reopen from the recents list — no sensitive content should be visible in the preview.
5. Set Kiswahili in onboarding, walk every module, background/reopen, force-quit and relaunch — all labels, validation errors, notifications copy and tab names remain Kiswahili.
6. Change to English in Settings → Language without pressing Confirm, navigate away — the saved language must remain Kiswahili.
7. Confirm English, restart — the app must start in English with no flash of Kiswahili after hydration.
8. Change the device language while the app is foregrounded and after a restart — the app language must not change.
