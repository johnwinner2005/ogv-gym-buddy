import { createFileRoute, Outlet } from "@tanstack/react-router";
import { History, Home, RefreshCw, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/shell";
import { settingsQuery, syncMyNotices } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/app")({
  component: MemberLayout,
});

function MemberLayout() {
  const { data: settings } = useQuery(settingsQuery);
  useEffect(() => {
    syncMyNotices().catch(() => {});
  }, []);
  return (
    <AppShell
      area="member"
      nav={[
        { to: "/app", label: "Dashboard", icon: Home, exact: true },
        { to: "/app/renew", label: "Renew membership", icon: RefreshCw },
        { to: "/app/history", label: "Payments & history", icon: History },
        { to: "/app/profile", label: "Profile", icon: UserRound },
      ]}
      footer={
        settings?.support_contact ? (
          <div className="rounded-md border border-ink-border p-3 text-xs text-ink-muted">
            <p className="font-medium text-ink-foreground">Need help?</p>
            <p className="mt-1">{settings.support_contact}</p>
          </div>
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  );
}
