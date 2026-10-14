import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { checkInsQuery } from "@/lib/api";
import { fmtDate, fmtTime } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/check-ins")({
  head: () => ({ meta: [{ title: "Check-ins — OGV Gym staff" }] }),
  component: CheckIns,
});

function CheckIns() {
  const [page, setPage] = useState(0);
  const q = useQuery(checkInsQuery(null, page));
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  return (
    <div className="animate-rise">
      <PageHeader
        title="Check-ins"
        description="Everyone admitted into the gym, newest first. Admit members from the Verify screen."
      />
      <section className="panel">
        {!d ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : d.rows.length === 0 ? (
          <EmptyState title="No check-ins yet">
            Verify a member and press "Admit entry" to record their visit.
          </EmptyState>
        ) : (
          <ul className="stagger">
            {d.rows.map((r) => {
              const m = d.people.get(r.member_id);
              const s = d.people.get(r.staff_id);
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-b px-5 py-3 text-sm last:border-0"
                >
                  <div className="w-24 text-xs text-muted-foreground tabular">
                    <p>{fmtDate(r.created_at)}</p>
                    <p>{fmtTime(r.created_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/admin/members/$id"
                      params={{ id: r.member_id }}
                      className="font-medium hover:underline"
                    >
                      {m?.full_name ?? "Member"}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {m?.member_code} {r.plan_name && `· ${r.plan_name}`}
                    </p>
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    by {s?.full_name ?? "staff"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {d && d.count > 30 && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 30 >= d.count}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
