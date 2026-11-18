import { createFileRoute } from "@tanstack/react-router";
import { en } from "@/i18n/en.ts";
import { GetHelpForm } from "@/routes/help";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: en.meta.helpTitle },
      { name: "robots", content: "noindex" },
      { name: "description", content: en.meta.helpDescription },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  return <GetHelpForm current="/report" />;
}
