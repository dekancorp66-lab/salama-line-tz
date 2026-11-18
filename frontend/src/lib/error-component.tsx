import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const { t, errorMessage } = useI18n();
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink"
    >
      <span className="text-pink" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-semibold">{t("errors.title")}</h1>
      <p className="max-w-md break-words text-sm leading-relaxed text-muted">
        {errorMessage(error)}
      </p>
      {error instanceof Error && error.message ? (
        <details className="max-w-md text-left text-xs text-muted">
          <summary className="cursor-pointer">{t("errors.technicalDetails")}</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
            {error.message}
          </pre>
        </details>
      ) : null}
    </main>
  );
}
