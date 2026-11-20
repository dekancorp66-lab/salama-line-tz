# SalamaLine mobile — manual QA checklist

Status key: **Executed** / **Not executed** / **Blocked**. Unless a row explicitly says *Executed*, it was not run in this phase. No simulator, emulator, native build or physical-device QA was performed here.

---

## 0. Automated checks actually executed

| Check | Command | Result |
|---|---|---|
| Mobile type check | `cd mobile && npm run typecheck` | Executed — passed after header/menu + theme toggle changes |
| Mobile unit tests | `cd mobile && npm test` | Executed — 72 passed, 0 failed (includes AI request, theme persistence, toggle-target and menu-route tests) |
| iOS JS bundle | `cd mobile && npx expo export --platform ios` | Executed — bundled successfully after header/menu + theme toggle changes |
| Android JS bundle | `cd mobile && npx expo export --platform android` | Executed — bundled successfully after header/menu + theme toggle changes |
| New backend auth tests | `cd backend && npx jest src/auth/mobile-auth.spec.ts --runInBand` | Executed earlier in this branch — 9 passed, 0 failed; backend unchanged by theme + AI work |
| Full backend suite | `cd backend && npm test -- --runInBand` | Executed earlier in this branch — 21 suites / 247 tests passed, 0 failed; backend unchanged by theme + AI work |

## 1. Registration

| # | Step | Expected | Status |
|---|---|---|---|
| 1.1 | Open Profile → Create account; submit empty form | Inline validation in the selected language; no request sent | Not executed |
| 1.2 | Enter invalid email, 11-character password, mismatched confirmation | Three specific errors; role field absent | Not executed |
| 1.3 | Register a new unique account against a real backend | Account created; app signs in; Home shown | Not executed |
| 1.4 | Repeat the same email | Translated conflict message; no raw server text | Not executed |
| 1.5 | Register with an injected `role=ADMIN` via request interception | Backend 400; no privileged account created | Not executed |

## 2. Login / logout

| # | Step | Expected | Status |
|---|---|---|---|
| 2.1 | Sign in with correct credentials | Loading → Home; token in SecureStore only | Not executed |
| 2.2 | Sign in with wrong password | Generic translated error; no account enumeration | Not executed |
| 2.3 | Sign in to an inactive staff account | Generic error; no staff UI appears | Not executed |
| 2.4 | Account → Sign out | Server revokes token; local token removed; Home shown | Not executed |
| 2.5 | Sign out while backend is unreachable | Local session still cleared; safe error only | Not executed |
| 2.6 | After sign-out, open Account directly | Redirect to sign-in | Not executed |

## 3. Persistence and protected routes

| # | Step | Expected | Status |
|---|---|---|---|
| 3.1 | Sign in, force-stop and reopen app | Session restored via `/auth/me`; Account accessible | Not executed |
| 3.2 | Revoke token server-side (increment `tokenVersion`) and reopen | Token cleared; anonymous state; no stale role | Not executed |
| 3.3 | Open Account while session is restoring | Loading state, then correct route decision | Not executed |
| 3.4 | Verify public screens work while signed out | Home, Learn, Support, Services, case tracking and AI remain usable | Not executed |

## 4. Roles and safeguarding

| # | Step | Expected | Status |
|---|---|---|---|
| 4.1 | Inspect all navigation surfaces (tabs, settings, deep links) | No Officers Portal, officer login/register, admin entry or staff case tools | Not executed |
| 4.2 | Sign in with a staff account | Neutral "use the approved staff workspace" notice; no extra capability | Not executed |
| 4.3 | Trigger Quick Exit from auth/account/settings/AI screens | Neutral screen only; no credentials, email, question text or request data | Not executed |
| 4.4 | Inspect logs during all auth and AI flows | No password, token, response body, case detail, contact value or AI question logged | Not executed |

## 5. Notifications

| # | Step | Expected | Status |
|---|---|---|---|
| 5.1 | Open Notifications with a fresh install | All preferences off; allow button disabled | Not executed |
| 5.2 | Toggle categories, restart app | Choices persist; unrelated categories unchanged | Not executed |
| 5.3 | Tick device consent, tap Allow | OS permission prompt appears only after consent | Not executed |
| 5.4 | Deny OS permission | Translated denial status; in-app preferences remain | Not executed |
| 5.5 | Inspect notification centre / previews | Neutral text only; no request, referral, name or contact detail | Not executed |
| 5.6 | Confirm stated limitation | UI says server push is unavailable; no claim of physical-device delivery | Not executed |

## 6. Language (Phase 4 regression)

| # | Step | Expected | Status |
|---|---|---|---|
| 6.1 | Switch to Kiswahili, visit auth/account/notifications/appearance/AI screens | All new strings translated; no mixed language | Not executed |
| 6.2 | Restart app and change OS language | Selected language persists and is not device-driven | Not executed |

## 7. Appearance (light / dark / system)

Automated persistence checks were executed; on-device appearance QA below is outstanding.

| # | Step | Expected | Status |
|---|---|---|---|
| 7.1 | Settings → Appearance → Light | All surfaces use light tokens; status bar text remains readable | Not executed |
| 7.2 | Settings → Appearance → Dark | All surfaces use dark tokens; no unreadable text or missing borders | Not executed |
| 7.3 | Settings → Appearance → System, change OS appearance | App follows the device appearance while `system` is selected | Not executed |
| 7.4 | Choose Light or Dark, force-stop and reopen app | Choice persists; it is not overwritten by OS appearance | Not executed |
| 7.5 | Trigger Quick Exit while in dark mode | Neutral screen also uses dark tokens | Not executed |
| 7.6 | Tap the top-right Moon in light mode | App switches to dark; Moon becomes Sun; choice saved | Not executed |
| 7.7 | Tap the top-right Sun in dark mode | App switches to light; Sun becomes Moon; choice saved | Not executed |

## 7A. Header and navigation menu

The app bar is shared by all `ScreenHeader` screens and onboarding: hamburger at top-left, "SalamaLine" centered, theme toggle at top-right. Quick Exit stays visible on the row below the app bar, so it remains one press. Automated route/label checks passed; on-device interaction QA below is outstanding.

| # | Step | Expected | Status |
|---|------|----------|--------|
| 7A.1 | Check header on Home, Learn, Support, Requests, Profile, Settings, AI and onboarding | Same horizontal alignment, safe-area spacing and touch targets; no content overlap | Not executed |
| 7A.2 | Tap the top-left hamburger | Menu opens; main screens are listed; no duplicate tab/navigation system appears | Not executed |
| 7A.3 | Tap a menu item, the dimmed area, the close icon and Android back | Menu closes and the chosen in-app route opens; no privileged entry point is present | Not executed |
| 7A.4 | Open the menu in dark mode | Menu panel, borders, icons and text use dark tokens | Not executed |
| 7A.5 | Trigger Quick Exit from a screen with the new header | Neutral screen only; no sensitive history remains | Not executed |
| 7A.6 | Switch language and reopen the menu | Menu labels and accessibility labels follow English or Kiswahili | Not executed |

## 8. AI assistant

Automated request-contract checks were executed; live backend and on-device QA below is outstanding.

| # | Step | Expected | Status |
|---|---|---|---|
| 8.1 | Open AI from Home, Profile and Settings | Screen loads; health card shows ready or unavailable without raw server text | Not executed |
| 8.2 | Ask a scoped question in English | Grounded answer, sources and generation mode are shown; no invented advice | Not executed |
| 8.3 | Switch to Kiswahili and ask a scoped question | Answer follows app language; Swahili UI strings remain translated | Not executed |
| 8.4 | Ask about immediate danger or an out-of-scope topic | Safety framing and human-support guidance shown; no automatic emergency claim | Not executed |
| 8.5 | Send an 11th request within one minute | Translated rate-limit error; no raw server text | Not executed |
| 8.6 | Go offline and ask a question | Translated network error; question remains only in memory | Not executed |
| 8.7 | Trigger Quick Exit from the AI screen | Neutral screen only; no typed question survives in navigation history | Not executed |
| 8.8 | Inspect logs and network inspector during AI flow | No question, answer, token or response body logged; only `/ai/health` and `/ai/ask` called | Not executed |

## 9. Device / build matrix (all outstanding)

| Environment | Status |
|---|---|
| iOS simulator | Not executed |
| Android emulator | Not executed |
| Native build (EAS or local) | Not executed |
| Physical iOS device | Not executed |
| Physical Android device | Not executed |
| Live backend auth/content/services/help/tracking happy/sad path | Not executed |
| Live backend AI `/ai/health` and `/ai/ask` | Not executed |
| Appearance persistence and system-mode following on a real device | Not executed |

## 10. Known baseline note

Before any change in this phase, `cd backend && npm test -- --runInBand` produced `1 failed suite / 2 failed tests` in `help-requests.controller.spec.ts`; an isolated rerun of that file passed 10/10. The post-change full run passed 21/21 suites and 247/247 tests, so the earlier failure was an order/timing flake and is not present in the recorded final result.

## 11. Expo Go runtime crash (reported after implementation)

| Item | Detail |
|---|---|
| Reported symptom | `TypeError: Cannot convert Symbol to string` from React's `useMemo`, attributed to `app/_layout.tsx` at the `<Stack>` element |
| Root cause | The normal Stack screens were wrapped in a JSX Fragment. Expo Router's `mapProtectedScreen` treats a Fragment as an unknown child and logs `${child.type}`, which is `Symbol(react.fragment)`. Hermes cannot coerce a Symbol to a string and throws. |
| Fix | `app/_layout.tsx` renders the screens as a plain keyed array instead of a Fragment; the Quick Exit branch remains a single `Stack.Screen`. A new `ai` screen was added to that keyed array for this phase. |
| Automated re-check | Executed — `npm run typecheck` passed, `npm test` 72/72 passed, `expo export --platform ios` and `--platform android` passed after the header/menu changes |
| Expo Go retest | **Pending user confirmation** — not claimed as executed by this environment |
| Follow-up devtools stack (header phase) | A later report showed the same crash path at `expo-router/build/fork/NavigationContainer.js:104-113` (`REACT_NAVIGATION_DEVTOOLS` `linking` getter). The only new root-level wrapper from the header phase (`Animated.View` around the app in `ThemeProvider`) was removed; icon-level toggle animation remains. Re-verified: typecheck passed, 72/72 tests passed, iOS and Android exports passed. If the crash repeats, clear the Metro cache with `npx expo start --clear` and force-quit Expo Go before reopening. |
| Asset download error on Android Expo Go | Reported `ExpoAsset.downloadAsync` rejection for `Ionicons.ttf` from `http://172.16.40.157:8082`. Verified from the dev machine that this exact URL returns HTTP 200 with the 389,724-byte font, and that ports 8081/8082 are listening. This is device-to-dev-server reachability, not an app-code or bundling defect. Use `npx expo start --tunnel --clear`, or fix LAN client isolation/firewall and allow both 8081 and 8082. No simulator/device retest performed here. |

Note: a separate `Web Bundling failed ... Unable to resolve "react-native-web/dist/index"` message can appear when Metro builds the web target; `react-native-web` is not declared in this mobile-only project. It does not affect the Android Expo Go path above.
