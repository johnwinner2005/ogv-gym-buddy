import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, ScanLine, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markNotificationsRead, meQuery, notificationsQuery } from "@/lib/api";
import { initials, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/status";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          onClick={onNavigate}
          activeOptions={{ exact: it.exact }}
          className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-sidebar-accent hover:text-ink-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-ink-foreground"
        >
          <it.icon className="size-[18px]" aria-hidden />
          <span className="flex-1">{it.label}</span>
          {!!it.badge && (
            <span className="rounded-full bg-warning px-1.5 py-px text-[11px] font-semibold text-ink tabular">{it.badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function Notifications({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery(notificationsQuery(userId));
  const unread = data.filter((n) => !n.read_at);
  return (
    <Popover
      onOpenChange={async (open) => {
        if (!open && unread.length) {
          await markNotificationsRead(unread.map((n) => n.id)).catch(() => {});
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
        }
      }}
    >
      <PopoverTrigger asChild>
        <button className="relative grid size-10 place-items-center rounded-md hover:bg-accent" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}>
          <Bell className="size-[18px]" />
          {unread.length > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
        <div className="border-b px-4 py-3 text-sm font-medium">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>}
          {data.map((n) => (
            <div key={n.id} className="flex gap-3 border-b px-4 py-3 last:border-0">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{relative(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({
  nav,
  children,
  area,
  footer,
}: {
  nav: NavItem[];
  children: ReactNode;
  area: "member" | "admin";
  footer?: ReactNode;
}) {
  const { data: me } = useQuery(meQuery);
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const name = me?.profile?.full_name || me?.user.email || "";

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar px-3 py-5 text-sidebar-foreground">
      <div className="px-3 pb-6">
        <Logo inverted />
      </div>
      <NavList items={nav} onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-3 px-1">
        {footer}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-muted hover:bg-sidebar-accent hover:text-ink-foreground"
        >
          <LogOut className="size-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[272px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <button className="grid size-10 place-items-center rounded-md hover:bg-accent lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex-1" />
          {area === "admin" && pathname !== "/admin/verify" && (
            <Button asChild size="sm" variant="brand" className="h-9">
              <Link to="/admin/verify">
                <ScanLine /> <span className="hidden sm:inline">Verify member</span>
                <span className="sm:hidden">Verify</span>
              </Link>
            </Button>
          )}
          {me && <Notifications userId={me.user.id} />}
          {me?.isStaff && area === "member" && (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/admin">Staff area</Link>
            </Button>
          )}
          {me?.isStaff && area === "admin" && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/app">My membership</Link>
            </Button>
          )}
          <div className="ml-1 hidden items-center gap-2.5 sm:flex">
            <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold">{initials(name)}</div>
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground font-mono">{me?.profile?.member_code}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
