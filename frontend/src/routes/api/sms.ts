import { createFileRoute } from "@tanstack/react-router";
import { authorized, getPlatform, readParams } from "@/salama/platform.server";
import { env } from "@/lib/env.server";

/**
 * Inbound SMS webhook (Africa's Talking: from, to, text; JSON also accepted).
 * Callback: https://YOUR-DOMAIN/api/sms?key=WEBHOOK_SECRET
 * Replies are sent through the SMS gateway, so we just acknowledge with 200.
 */
export const Route = createFileRoute("/api/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request, env("WEBHOOK_SECRET"))) return new Response("unauthorized", { status: 401 });
        const q = await readParams(request);
        if (!q.from || !q.text) return new Response("ok");
        try {
          await (await getPlatform()).text({ from: q.from, text: q.text, channel: "sms" });
        } catch (e) {
          console.error("[sms] failed:", (e as Error).message);
        }
        return new Response("ok");
      },
    },
  },
});
