import { createFileRoute } from "@tanstack/react-router";
import { authorized, getPlatform, readParams } from "@/salama/platform.server";
import { env } from "@/lib/env.server";

/**
 * USSD webhook (Africa's Talking format: sessionId, phoneNumber, text).
 * Configure the callback as  https://YOUR-DOMAIN/api/ussd?key=WEBHOOK_SECRET
 * Replies are plain text starting with CON (continue) or END.
 */
export const Route = createFileRoute("/api/ussd")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request, env("WEBHOOK_SECRET"))) return new Response("END Service unavailable.", { status: 401 });
        const q = await readParams(request);
        try {
          const p = await getPlatform();
          const body = await p.ussd({ sessionId: q.sessionId ?? "", phone: q.phoneNumber ?? "", text: q.text ?? "" });
          return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        } catch (e) {
          console.error("[ussd] failed:", (e as Error).message);
          // Always give the user a safe screen with the free helpline, never a stack trace.
          return new Response(`END Hitilafu imetokea. Piga ${env("SALAMA_HELPLINE") ?? "116"} (bure).`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
      },
    },
  },
});
