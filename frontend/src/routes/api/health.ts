import { createFileRoute } from "@tanstack/react-router";
import { getPlatform, isLive } from "@/salama/platform.server";
import { env } from "@/lib/env.server";

/**
 * Go-live readiness. Public and non-sensitive: it reports COUNTS only, so
 * partners can see how much content is approved and how many services verified.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const warnings: string[] = [];
        let p;
        try { p = await getPlatform(); } catch (e) { return Response.json({ ok: false, live: isLive(), error: (e as Error).message }, { status: 503 }); }
        const c = p.core.cfg;
        const approved = c.content.filter((x) => x.status === "approved").length;
        const verified = c.services.filter((s) => s.verifiedBy && s.verifiedAt).length;
        const responders = (await p.core.store.listResponders({ activeOnly: true })).length;
        if (approved < c.content.length) warnings.push(`${c.content.length - approved} content items are not approved yet`);
        if (verified < c.services.length) warnings.push(`${c.services.length - verified} directory entries are not verified yet`);
        if (!responders) warnings.push("no active responders registered");
        if (!env("AT_API_KEY")) warnings.push("no SMS gateway configured");
        if (env("WA_TOKEN") && (!env("WA_APP_SECRET") || !env("WA_VERIFY_TOKEN"))) warnings.push("WhatsApp is on but WA_APP_SECRET or WA_VERIFY_TOKEN is missing");
        if (!env("CRON_SECRET")) warnings.push("CRON_SECRET not set: escalation sweep cannot run");
        if (!env("WEBHOOK_SECRET")) warnings.push("WEBHOOK_SECRET not set: webhooks are unauthenticated");
        return Response.json({
          ok: true, live: isLive(), content: { approved, total: c.content.length },
          services: { verified, total: c.services.length }, responders, readyForGirls: isLive() && warnings.length === 0, warnings,
        });
      },
    },
  },
});
