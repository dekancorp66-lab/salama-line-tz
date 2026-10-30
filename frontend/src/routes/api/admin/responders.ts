import { createFileRoute } from "@tanstack/react-router";
import { authorized, getPlatform, readParams } from "@/salama/platform.server";
import { maskPhone } from "@/salama/privacy";
import { env } from "@/lib/env.server";

/**
 * Responder roster. Bearer ADMIN_TOKEN.
 *   POST   {id,name,phone,district,role}  add/update (district id or "*" for focal)
 *   PATCH  {id,active:"true"|"false"}     deactivate a responder who has left
 *   GET                                   list (numbers masked)
 * Vetting, training and signing the confidentiality + child-protection code
 * happen BEFORE anyone is added here.
 */
export const Route = createFileRoute("/api/admin/responders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request, env("ADMIN_TOKEN"))) return new Response("unauthorized", { status: 401 });
        const p = await getPlatform();
        const rs = await p.core.store.listResponders();
        return Response.json(rs.map((r) => ({ id: r.id, name: r.name, phone: maskPhone(r.phone), district: r.district, role: r.role, active: r.active })));
      },
      POST: async ({ request }) => {
        if (!authorized(request, env("ADMIN_TOKEN"))) return new Response("unauthorized", { status: 401 });
        const q = await readParams(request);
        const p = await getPlatform();
        const okDistrict = q.district === "*" || p.core.cfg.districts.some((d) => d.id === q.district);
        if (!q.id || !q.name || !q.phone || !okDistrict || !["responder", "focal"].includes(q.role)) {
          return Response.json({ error: "need id, name, phone, role (responder|focal) and a valid district id or *" }, { status: 400 });
        }
        if ((q.role === "focal") !== (q.district === "*")) return Response.json({ error: "focal persons use district * ; responders use a district id" }, { status: 400 });
        await p.addResponder({ id: q.id, name: q.name, phone: q.phone, district: q.district, role: q.role as "responder" | "focal" });
        return Response.json({ ok: true });
      },
      PATCH: async ({ request }) => {
        if (!authorized(request, env("ADMIN_TOKEN"))) return new Response("unauthorized", { status: 401 });
        const q = await readParams(request);
        const ok = await (await getPlatform()).core.store.setResponderActive(q.id ?? "", q.active !== "false");
        return Response.json({ ok }, { status: ok ? 200 : 404 });
      },
    },
  },
});
