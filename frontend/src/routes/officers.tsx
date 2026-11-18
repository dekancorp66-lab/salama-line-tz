import { createFileRoute, Outlet } from "@tanstack/react-router";
import { en } from "@/i18n/en.ts";

export const Route = createFileRoute("/officers")({
  head: () => ({
    meta: [
      { title: en.meta.officersTitle },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: en.meta.officersDescription },
    ],
  }),
  component: OfficersLayout,
});

function OfficersLayout() {
  return <Outlet />;
}
