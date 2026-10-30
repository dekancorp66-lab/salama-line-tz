# SalamaLine: what the code does, and what only people can do

The platform is complete as software. These are the things no code can do for you,
in the order they block launch. `GET /api/health` reports progress on all of them.

## 1. Content approval (blocks live mode)
`src/salama/data/content.ts` holds placeholder text. In live mode the engine serves **only**
items with `status: "approved"`, a named `reviewer`, `reviewedAt` and `source`.
A health/child-protection professional reviews the English, a native Swahili speaker and
young women review the Swahili, then the item is flipped to approved in a reviewed pull request.
Legal statements (minimum marriage age, mandatory reporting) need a lawyer's sign-off.

## 2. Verified service directory (blocks live mode)
`src/salama/data/services.ts` contains `[SAMPLE]` entries. Replace them with services a named
partner confirmed in writing; set `verifiedBy` and `verifiedAt`. Unverified entries are never shown live.

## 3. Responders (blocks live mode)
Vet, train, and have each person sign the confidentiality and child-protection code **before**
adding them: `POST /api/admin/responders` (see the route's comment). Cover every district with at
least two responders and one focal person (`district: "*"`). Test by sending a real ACK from each phone.
Decide, with legal advice, the protocol for mandatory reporting duties; the software never contacts
police or family by itself, but your responders may have legal obligations.

## 4. Telecom
- Apply for a USSD short code and SMS sender ID through your aggregator (Africa's Talking) and the
  operators/TCRA. This takes weeks; start now. Ask about zero-rating so girls pay nothing.
- USSD callback: `https://YOUR-DOMAIN/api/ussd?key=WEBHOOK_SECRET`
- SMS callback:  `https://YOUR-DOMAIN/api/sms?key=WEBHOOK_SECRET`
- WhatsApp (Meta Cloud API), step by step:
  1. In Meta for Developers create an app, add the **WhatsApp** product and a WhatsApp Business number
     (a test number works for the pilot demo; the real number needs business verification).
  2. Copy the **Phone number ID** into `WA_PHONE_ID`, and create a permanent **System User token** into `WA_TOKEN`
     (the temporary 24-hour token will stop working).
  3. Copy the app's **App Secret** into `WA_APP_SECRET` and invent a long random `WA_VERIFY_TOKEN`.
  4. In WhatsApp > Configuration set Callback URL `https://YOUR-DOMAIN/api/whatsapp` and the same verify token,
     then subscribe to the **messages** field. Meta calls the URL once to verify it.
  5. Send "SALAMA" to the number from a phone. You should get the menu back. `/api/health` warns if a WhatsApp
     secret is missing.
  Behaviour to know: replies work for 24 hours after the girl's last message (WhatsApp's rule), which is fine
  because she always writes first. Photos and voice notes get the "how to use SalamaLine" reply. Meta retries
  are ignored. Responder alerts still go by SMS. Set `WA_API_VERSION` if Meta retires the default Graph version.

## 5. Scheduler (blocks live mode)
Escalation and the automatic wipe only run when `/api/cron/sweep` is called. Call it every 5 minutes
with `Authorization: Bearer $CRON_SECRET`. Vercel Cron works on Pro (the Hobby plan only allows
daily); otherwise use any external pinger. If it stops, unanswered requests are NOT escalated.

## 6. Independent reviews (before any pilot)
Safeguarding and privacy review, a data-protection assessment under Tanzania's Personal Data
Protection Act, and a security test. Confirm the helpline number in `SALAMA_HELPLINE` is current.

## Honest limits to tell users
Her mobile operator can still see that she used a service. Anonymous reports hold no number, but
USSD/SMS traffic is visible to the network. The shared-phone risk (a family member reading the SMS
inbox) is why message wording is neutral and `00` exits instantly.

## Go-live check
`GET /api/health` -> `readyForGirls: true` only when live mode is on, all content approved, all
services verified, responders registered, an SMS gateway configured, and the secrets set.
