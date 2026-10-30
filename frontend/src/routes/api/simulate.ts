import { createFileRoute } from "@tanstack/react-router";
import { DEMO, drain, getSim, readParams } from "@/salama/platform.server";

/**
 * Website simulator backend. Runs the REAL engine in an isolated sandbox:
 * memory-only, fake numbers, captured messages, fake clock. It can never send a
 * real SMS or touch real data. Actions: ussd | text | advance | reset.
 */
export const Route = createFileRoute("/api/simulate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const q = await readParams(request);
        if (q.action === "reset") {
          (globalThis as any).__salamaSims?.delete((q.simId ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "anon");
        }
        const s = await getSim(q.simId ?? "");
        if (++s.n > 400) return Response.json({ error: "demo limit reached, refresh the page" }, { status: 429 });
        const text = (q.text ?? "").slice(0, 160);
        const from = q.as === "responder" ? DEMO.responder : q.as === "focal" ? DEMO.focal : DEMO.girl;
        let screen: string | null = null;
        if (q.action === "ussd") screen = await s.p.ussd({ sessionId: q.sessionId || "sim", phone: DEMO.girl, text });
        else if (q.action === "text") await s.p.text({ from, text, channel: "sms" });
        else if (q.action === "advance") {
          s.clock.t += Math.min(Math.max(Number(q.minutes) || 0, 0), 24 * 60) * 60_000;
          await s.p.sweep();
        }
        return Response.json({ screen, delivered: drain(s) });
      },
    },
  },
});
