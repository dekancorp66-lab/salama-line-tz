# SalamaLine mobile — notification architecture (Phase 8/9 hardening)

Companion to `docs/mobile/authentication.md`. This build implements **privacy-first local notification preferences and permission UI only**. It does not claim working server push or physical-device delivery.

---

## 1. What exists today

| Layer | State |
|---|---|
| `NotificationOutbox` (Prisma) | Metadata-only rows written when a case is escalated: `channel`, `templateKey`, `destinationHash: null`, `status: 'PENDING'`. No destination, body or phone number is stored. |
| Delivery adapters | **None.** Integration controllers are placeholders reporting `configured: false, operational: false`. There is no queue worker, scheduler or dispatcher. |
| Server push endpoints | **None.** No device-token registration and no notification API. |
| User preference fields | **None** in the Prisma `User` model. |
| Mobile local notifications | Permission can be requested through `expo-notifications`, and the notification centre can display locally scheduled neutral text. No server-triggered notification is implemented. |

## 2. Client preferences

`mobile/src/store/notificationPreferencesStore.ts` persists with Zustand + AsyncStorage (non-secret data only):

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Master switch for in-app reminders. |
| `categories.general` | `false` | General neutral reminders. |
| `categories.requestUpdates` | `false` | Neutral "there is an update" reminders only. |
| `categories.safetyTips` | `false` | Safety information. |
| `deviceConsent` | `false` | Explicit consent required before device permission is requested. |

- All defaults are **off**; nothing is enabled without an explicit user action.
- Persisted values are sanitized on load: unknown categories, non-boolean values and unknown fields are discarded. Tokens are never written to this store (a unit test asserts this).
- The UI is in `mobile/app/notifications.tsx`, reachable from Settings and Profile. The "allow" button is disabled until `deviceConsent` is true.

## 3. Privacy rules

1. **No sensitive previews.** Notification text is limited to neutral strings such as "You have a new update in SalamaLine." Request topics, case codes, referrals, names, contact details and location are never included.
2. **Consent first.** Device permission is only requested after the user ticks the explicit consent control. Denied permission leaves in-app preferences intact.
3. **In-app vs device push is explicit.** The screen has separate sections and states that server push is unavailable in this build. A user cannot be led to believe a device notification will arrive from the server.
4. **No automatic contact.** Nothing in this layer contacts emergency services, family, police or a case worker.
5. **No logging.** No notification body, token or permission result is logged.

## 4. Platform limitations (explicit)

- `expo-notifications` permission is a **local device permission**. It does not create a server push channel.
- Actual delivery depends on the OS, background restrictions, notification settings and whether anything schedules a local notification. None of this has been verified on a simulator, emulator, native build or physical device in this phase.
- No APNs/FCM credentials, no EAS notification plugin configuration and no push token registration were added.
- Deep-link behaviour is designed to land on the neutral screen first; this is documented intent, not a tested device behaviour.

## 5. Verification performed

Unit tests cover private defaults, persistence across simulated restarts, independent category toggles, explicit device consent, sanitization of malformed persisted state and absence of credential fields in storage. Typecheck and both Expo bundles pass. **Not executed:** notification-centre inspection, permission-denied device path, deep-link tap, simulator/emulator or physical-device QA.
