import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { overviewQuery, reportsQuery } from "@/lib/api";
import { naira } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, Stat } from "@/components/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — OGV Gym staff" }] }),
  component: Reports,
});

const LABEL: Record<string, string> = {
  granted: "Granted",
  expired: "Denied · expired",
  suspended: "Denied · suspended",
  cancelled: "Denied · cancelled",
  no_membership: "Denied · no membership",
  not_found: "Not found",
};

function Reports() {
  const [days, setDays] = useState(30);
  const r = useQuery(reportsQuery(days));
  const ov = useQuery(overviewQuery);
  const d = r.data;
  const maxRev = Math.max(1, ...(d?.by_plan.map((p) => Number(p.revenue)) ?? [1]));
  const totalChecks = Object.values(d?.verifications ?? {}).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="animate-rise">
      <PageHeader
        title="Reports"
        description="Figures are based on approved payments only."
        actions={
          <div className="flex gap-1">
            {[7, 30, 90, 365].map((n) => (
              <button
                key={n}
                onClick={() => setDays(n)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  days === n ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {n === 365 ? "1 year" : `${n} days`}
              </button>
            ))}
          </div>
        }
      />
      {r.isError ? (
        <ErrorState error={r.error} onRetry={() => r.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Verified revenue" value={d ? naira(d.revenue) : "…"} />
            <Stat label="Payments approved" value={d?.approved ?? "…"} />
            <Stat label="Payments rejected" value={d?.rejected ?? "…"} />
            <Stat label="New registrations" value={d?.new_members ?? "…"} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="panel p-5">
              <h2 className="mb-4 font-medium">Revenue by plan</h2>
              {d?.by_plan.length ? (
                <ul className="space-y-3">
                  {d.by_plan.map((p) => (
                    <li key={p.name}>
                      <div className="flex justify-between text-sm">
                        <span>
                          {p.name} <span className="text-muted-foreground">· {p.count}</span>
                        </span>
                        <span className="font-medium tabular">{naira(p.revenue)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(Number(p.revenue) / maxRev) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No approved payments in this period" />
              )}
            </section>
            <section className="panel p-5">
              <h2 className="mb-4 font-medium">Entry checks</h2>
              {totalChecks ? (
                <ul className="space-y-2 text-sm">
                  {Object.entries(d!.verifications).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b pb-2 last:border-0">
                      <span>{LABEL[k] ?? k}</span>
                      <span className="tabular">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No entry checks in this period" />
              )}
            </section>
            <section className="panel p-5 lg:col-span-2">
              <h2 className="mb-4 font-medium">Membership base today</h2>
              {ov.data && (
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
                  {[
                    ["Active", ov.data.active],
                    ["Expired", ov.data.expired],
                    ["Not activated", ov.data.none],
                    ["Suspended", ov.data.suspended],
                    ["Total", ov.data.total],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <p className="text-muted-foreground">{k}</p>
                      <p className="font-display text-2xl font-semibold tabular">{v}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
