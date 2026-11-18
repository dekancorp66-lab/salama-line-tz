import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useStaffSession } from "@/lib/staff-session";

export const Route = createFileRoute("/officers/")({
  component: OfficersIndex,
});

function OfficersIndex() {
  const session = useStaffSession();
  return <Navigate to={session.token && session.user ? "/officers/dashboard" : "/officers/login"} />;
}
