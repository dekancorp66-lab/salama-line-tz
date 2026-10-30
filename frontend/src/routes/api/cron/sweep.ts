import { createFileRoute } from "@tanstack/react-router";
import { authorized, getPlatform } from "@/salama/platform.server";
import { env } from "@/lib/env.server";

/**
 * Escalation + retention sweep. MUST run every ~5 minutes in production:
 * it re-alerts unanswered cases, escalates to the focal person, and wipes
 * contact details that outlive the retention window.
 * Auth: "Authorization: Bearer CRON_SECRET" (Vercel Cron sends this) or ?key=.
 */
const run = async ({ request }: { request: Request }) => {
  if (!authorized(request, env("CRON_SECRET"))) return new Response("unauthorized", { status: 401 });
  const r = await (await getPlatform()).sweep();
  return Response.json(r);
};
export const Route = createFileRoute("/api/cron/sweep")({ server: { handlers: { GET: run, POST: run } } });
