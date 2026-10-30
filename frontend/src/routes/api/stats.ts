import { createFileRoute } from "@tanstack/react-router";
import { authorized, getPlatform } from "@/salama/platform.server";
import { env } from "@/lib/env.server";

/** Anonymous, aggregated partner statistics. Bearer DASHBOARD_TOKEN. Small counts are hidden. */
export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request, env("DASHBOARD_TOKEN"))) return new Response("unauthorized", { status: 401 });
        return Response.json(await (await getPlatform()).stats(), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
