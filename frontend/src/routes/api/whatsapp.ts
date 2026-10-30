import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "node:crypto";
import { getPlatform, isLive } from "@/salama/platform.server";
import { safeEqual } from "@/salama/privacy";
import { parseWhatsApp } from "@/salama/whatsapp";
import { WhatsAppGateway } from "@/salama/gateway";
import { env } from "@/lib/env.server";

/**
 * WhatsApp Cloud API webhook.
 *   GET  = Meta's verification handshake (WA_VERIFY_TOKEN)
 *   POST = incoming messages, signed by Meta (WA_APP_SECRET)
 * Callback URL: https://YOUR-DOMAIN/api/whatsapp
 */
export const Route = createFileRoute("/api/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const tok = env("WA_VERIFY_TOKEN");
        if (tok && u.searchParams.get("hub.mode") === "subscribe" && safeEqual(u.searchParams.get("hub.verify_token") ?? "", tok)) {
          return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = env("WA_APP_SECRET");
        if (secret || isLive()) {
          // Meta signs every delivery. Reject anything that is not from Meta.
          const sig = request.headers.get("x-hub-signature-256") ?? "";
          const want = `sha256=${createHmac("sha256", secret ?? "").update(raw).digest("hex")}`;
          if (!secret || !safeEqual(sig, want)) return new Response("unauthorized", { status: 401 });
        }
        try {
          const p = await getPlatform();
          const reader = env("WA_TOKEN") && env("WA_PHONE_ID")
            ? new WhatsAppGateway({ token: env("WA_TOKEN")!, phoneId: env("WA_PHONE_ID")!, version: env("WA_API_VERSION") })
            : null;
          for (const m of parseWhatsApp(JSON.parse(raw))) {
            // Meta retries a delivery it thinks failed. Answer each message once.
            const first = await p.core.store.claimOnce(`wa:${m.id}`, Date.now(), 24 * 3_600_000);
            if (!first) continue;
            await reader?.markRead(m.id);
            // Photos, voice notes etc. get the normal "how to use SalamaLine" reply (an empty command).
            await p.text({ from: m.from, text: m.unsupported ? "" : m.text, channel: "whatsapp" });
          }
        } catch (e) {
          console.error("[whatsapp] failed:", (e as Error).message);
        }
        return new Response("ok"); // always 200 so Meta does not retry-storm
      },
    },
  },
});
