import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutGrid,
  ReceiptText,
  ScanLine,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, type NavItem } from "@/components/shell";
import { meQuery, overviewQuery } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("reception")) throw redirect({ to: "/app" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { data: me } = useQuery(meQuery);
  const { data: ov } = useQuery(overviewQuery);
  const admin = me?.isAdmin;
  const nav: NavItem[] = [
    { to: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
    { to: "/admin/verify", label: "Verify membership", icon: ScanLine },
    { to: "/admin/members", label: "Members", icon: Users },
    ...(admin
      ? [
          {
            to: "/admin/payments",
            label: "Payment verification",
            icon: ReceiptText,
            badge: ov?.pending_payments,
          },
          { to: "/admin/expiry", label: "Membership expiry", icon: CalendarClock },
          { to: "/admin/plans", label: "Membership plans", icon: Tags },
          { to: "/admin/reports", label: "Reports", icon: BarChart3 },
          { to: "/admin/logs", label: "Activity logs", icon: ClipboardList },
          { to: "/admin/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];
  return (
    <AppShell area="admin" nav={nav}>
      <Outlet />
    </AppShell>
  );
}
