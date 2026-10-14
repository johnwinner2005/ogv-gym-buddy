import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ScanLine } from "lucide-react";
import { meQuery, membersQuery, overviewQuery, paymentQueueQuery, verificationLogQuery } from "@/lib/api";
import { fmtDate, fmtTime, naira, relative } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, Stat, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Overview — OGV Gym staff" }] }),
  component: Overview,
});

const DECISION_LABEL: Record<string, string> = {
  granted: "Granted",
  expired: "Expired",
  suspended: "Suspended",
  cancelled: "Cancelled",
  no_membership: "No membership",
  not_found: "Not found",
};

function Overview() {
  const { data: me } = useQuery(meQuery);
  const ov = useQuery(overviewQuery);
  const queue = useQuery({ ...paymentQueueQuery("open"), enabled: !!me?.isAdmin });
  const expiring = useQuery(membersQuery("", "expiring", 0, 6));
  const checks = useQuery(verificationLogQuery);

  if (ov.isError) return <ErrorState error={ov.error} onRetry={() => ov.refetch()} />;
  const o = ov.data;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Overview"
        description="What needs attention today."
        actions={
          <Button asChild size="lg" variant="brand">
            <Link to="/admin/verify">
              <ScanLine /> Verify a member
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {o ? (
          <>
            <Stat label="Pending payments" value={o.pending_payments} tone={o.pending_payments ? "warning" : undefined} hint="Awaiting review" />
            <Stat label={`Expiring in ${o.expiring_soon_days} days`} value={o.expiring_soon} tone={o.expiring_soon ? "warning" : undefined} />
            <Stat label="Active memberships" value={o.active} tone="success" />
            <Stat label="Expired" value={o.expired} tone={o.expired ? "danger" : undefined} />
            <Stat label="Total members" value={o.total} hint={`${o.none} not activated · ${o.suspended} suspended`} />
          </>
        ) : (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {me?.isAdmin && (
          <section className="panel">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-medium">Payment queue</h2>
              <Link to="/admin/payments" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Review all <ArrowRight className="size-3" />
              </Link>
            </div>
            {queue.data?.length === 0 ? (
              <EmptyState title="Queue is clear">No payments are waiting for review.</EmptyState>
            ) : (
              <ul>
                {queue.data?.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/admin/payments"
                      search={{ id: p.id }}
                      className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.member?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.membership_plans?.name} · {relative(p.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular">{naira(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="panel">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-medium">Expiring soon</h2>
            <Link to="/admin/expiry" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {expiring.data?.length === 0 ? (
            <EmptyState title="Nobody expiring soon" />
          ) : (
            <ul>
              {expiring.data?.map((m) => (
                <li key={m.id}>
                  <Link to="/admin/members/$id" params={{ id: m.id }} className="flex items-center gap-3 border-b px-5 py-3 last:border-0 hover:bg-muted/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.full_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.member_code}</p>
                    </div>
                    <span className="text-xs text-warning-foreground tabular">{fmtDate(m.expires_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-medium">Recent entry checks</h2>
            <span className="text-xs text-muted-foreground">{o?.verifications_today ?? 0} today</span>
          </div>
          {checks.data?.length === 0 ? (
            <EmptyState title="No checks recorded yet" />
          ) : (
            <ul className="grid sm:grid-cols-2">
              {checks.data?.slice(0, 10).map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b px-5 py-3 text-sm">
                  <span className="w-12 text-xs text-muted-foreground tabular">{fmtTime(c.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate">{c.member?.full_name ?? "Unknown"}</span>
                  <span className={c.result === "granted" ? "text-success" : "text-danger"}>{DECISION_LABEL[c.result] ?? c.result}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
