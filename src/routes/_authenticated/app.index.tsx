import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  MessageCircleQuestion,
  XCircle,
} from "lucide-react";
import {
  meQuery,
  memberPaymentsQuery,
  myPeriodsQuery,
  myStatusQuery,
  settingsQuery,
} from "@/lib/api";
import { daysRemaining } from "@/lib/membership";
import { fmtDate, fmtDateTime, fmtLongDate, naira } from "@/lib/format";
import { ErrorState, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "My membership — OGV Gym" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const { data: me } = useQuery(meQuery);
  const status = useQuery(myStatusQuery);
  const uid = me?.user.id ?? "";
  const periods = useQuery({ ...myPeriodsQuery(uid), enabled: !!uid });
  const payments = useQuery({ ...memberPaymentsQuery(uid), enabled: !!uid });
  const { data: settings } = useQuery(settingsQuery);

  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  if (!status.data || !me) return <DashboardSkeleton />;

  const s = status.data;
  const first = (me.profile?.full_name || "").split(" ")[0];
  const days = daysRemaining(s.expires_at);
  const latest = payments.data?.[0];
  const open =
    payments.data?.filter((p) => p.status === "pending" || p.status === "clarification") ?? [];
  const totalMs =
    s.starts_at && s.expires_at
      ? new Date(s.expires_at).getTime() - new Date(s.starts_at).getTime()
      : 0;
  const pct =
    totalMs > 0
      ? Math.min(
          100,
          Math.max(0, ((Date.now() - new Date(s.starts_at!).getTime()) / totalMs) * 100),
        )
      : 0;
  const soon =
    s.status === "active" && days !== null && days <= (settings?.expiring_soon_days ?? 5);

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <p className="text-sm text-muted-foreground">{greeting()},</p>
        <h1 className="text-3xl font-semibold">{first || "member"}</h1>
      </div>

      {/* Notices */}
      {open.map((p) =>
        p.status === "clarification" ? (
          <Notice
            key={p.id}
            tone="info"
            icon={MessageCircleQuestion}
            title="The gym needs more information about your payment"
          >
            {p.review_note} —{" "}
            <Link to="/app/history" className="font-medium underline underline-offset-4">
              Reply
            </Link>
          </Notice>
        ) : (
          <Notice key={p.id} tone="warning" icon={Clock} title="Renewal awaiting verification">
            {naira(p.amount)} for {p.membership_plans?.name ?? "a plan"}, submitted{" "}
            {fmtDateTime(p.created_at)}. Your membership won't change until staff approve it.
          </Notice>
        ),
      )}
      {latest?.status === "rejected" && open.length === 0 && (
        <Notice tone="danger" icon={XCircle} title="Your last payment was not approved">
          {latest.review_note}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Membership card */}
        <section
          className={cn(
            "relative overflow-hidden rounded-xl p-6 sm:p-8",
            s.status === "active" || s.status === "scheduled" ? "ink-surface" : "panel",
            s.status === "suspended" && "stripes-suspended",
          )}
        >
          <p
            className={cn(
              "eyebrow",
              (s.status === "active" || s.status === "scheduled") && "text-ink-muted",
            )}
          >
            Your membership
          </p>
          <div className="mt-3">
            <StatusBadge status={s.status} className="text-sm" />
          </div>

          {s.status === "none" && (
            <>
              <h2 className="mt-4 text-2xl font-semibold">No active membership yet</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Your account is ready. Choose a plan and submit your payment — the gym activates
                your membership once the payment is verified.
              </p>
              <Button asChild className="mt-6" size="lg">
                <Link to="/app/renew">
                  Choose a plan <ArrowRight />
                </Link>
              </Button>
            </>
          )}

          {(s.status === "active" || s.status === "scheduled") && (
            <>
              <h2 className="mt-4 text-3xl font-semibold">{s.plan_name}</h2>
              <div className="mt-6 grid grid-cols-2 gap-6 border-t border-ink-border pt-5">
                <div>
                  <p className="text-xs text-ink-muted">
                    {s.status === "scheduled" ? "Starts" : "Started"}
                  </p>
                  <p className="mt-1 font-medium tabular">{fmtDate(s.starts_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Valid until</p>
                  <p className="mt-1 font-medium tabular">{fmtDateTime(s.expires_at)}</p>
                </div>
              </div>
              {s.status === "active" && (
                <div className="mt-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-border">
                    <div
                      className={cn("h-full rounded-full", soon ? "bg-warning" : "bg-brand")}
                      style={{ width: `${100 - pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink-foreground/80 tabular">
                    {days} day{days === 1 ? "" : "s"} remaining
                    {soon && " · renew soon to avoid a gap"}
                  </p>
                </div>
              )}
              <Button asChild variant="ink" className="mt-6">
                <Link to="/app/renew">Renew early</Link>
              </Button>
            </>
          )}

          {s.status === "expired" && (
            <>
              <h2 className="mt-4 text-2xl font-semibold">Your {s.plan_name} membership ended</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Expired on {fmtLongDate(s.expires_at)}. Gym entry is paused until you renew.
              </p>
              <Button asChild className="mt-6" size="lg">
                <Link to="/app/renew">
                  Renew membership <ArrowRight />
                </Link>
              </Button>
            </>
          )}

          {(s.status === "suspended" || s.status === "cancelled") && (
            <>
              <h2 className="mt-4 text-2xl font-semibold">
                {s.status === "suspended"
                  ? "Your membership is suspended"
                  : "Your membership was cancelled"}
              </h2>
              {s.access_reason && (
                <p className="mt-2 text-sm text-muted-foreground">Reason: {s.access_reason}</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Gym entry isn't available.{" "}
                {settings?.support_contact || "Please contact the front desk."}
              </p>
            </>
          )}
        </section>

        {/* Pass */}
        <section className="panel flex flex-col items-center p-6 text-center">
          <p className="eyebrow self-start">Member pass</p>
          <div className="mt-4 rounded-lg border bg-card p-3">
            <QRCodeSVG value={`OGV:${s.member_id}`} size={148} level="M" />
          </div>
          <p className="mt-3 font-mono text-lg font-medium">{s.member_code}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Show this at the front desk. Staff check your live status — the code alone doesn't grant
            entry.
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-medium">Membership history</h3>
            <Link to="/app/history" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {periods.data?.length ? (
            <ul>
              {periods.data.slice(0, 4).map((p) => {
                const now = Date.now();
                const st =
                  new Date(p.ends_at).getTime() <= now
                    ? "expired"
                    : new Date(p.starts_at).getTime() > now
                      ? "scheduled"
                      : "active";
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0"
                  >
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.plan_name}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        {fmtDate(p.starts_at)} – {fmtDate(p.ends_at)}
                      </p>
                    </div>
                    <StatusBadge status={st} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No membership periods yet.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-medium">Recent payments</h3>
            <Link to="/app/history" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {payments.data?.length ? (
            <ul>
              {payments.data.slice(0, 4).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular">
                      {naira(p.amount)} · {p.membership_plans?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(p.created_at)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No payments submitted yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "warning" | "danger" | "info";
  icon: typeof AlertTriangle;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3",
        tone === "warning" && "border-warning/30 bg-warning-soft text-warning-foreground",
        tone === "danger" && "border-danger/25 bg-danger-soft text-danger",
        tone === "info" && "border-info/25 bg-info-soft text-info",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        {children && <p className="mt-0.5 opacity-90">{children}</p>}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-48" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
