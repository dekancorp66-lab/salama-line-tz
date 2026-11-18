import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";

/**
 * Public, non-sensitive channel availability. Reports booleans only — never
 * short codes, phone numbers, tokens or provider configuration values.
 */
export const Route = createFileRoute("/api/channels-status")({
  server: {
    handlers: {
      GET: async () => {
        const shortCode = env("USSD_SHORT_CODE");
        const smsConfigured = Boolean(env("AT_API_KEY") && env("AT_USERNAME"));
        const whatsappConfigured = Boolean(
          env("WA_TOKEN") && env("WA_PHONE_ID") && env("WA_APP_SECRET") && env("WA_VERIFY_TOKEN"),
        );
        return Response.json({
          ussd: { configured: Boolean(shortCode), shortCode: shortCode || null },
          sms: { configured: smsConfigured },
          whatsapp: { configured: whatsappConfigured },
        });
      },
    },
  },
});
