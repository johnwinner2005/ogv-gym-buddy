import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auditQuery } from "@/lib/api";
import { fmtDateTime, naira } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({ meta: [{ title: "Activity logs — OGV Gym staff" }] }),
  component: Logs,
});

const ACTION: Record<string, string> = {
  "payment.submitted": "submitted a payment",
  "payment.approved": "approved a payment",
  "payment.rejected": "rejected a payment",
  "payment.clarification": "asked for clarification",
  "payment.clarified": "replied to a clarification",
  "membership.activated": "activated a membership",
  "membership.extended": "extended a membership",
  "membership.reactivated": "reactivated a membership",
  "membership.suspended": "suspended a membership",
  "membership.cancelled": "cancelled a membership",
  "membership.restored": "restored access",
  "role.granted": "granted a staff role",
  "role.revoked": "removed a staff role",
  "profile.updated": "updated a profile",
};

function summary(d: Record<string, unknown>) {
  const parts: string[] = [];
  if (d.plan) parts.push(String(d.plan));
  if (d.amount) parts.push(naira(d.amount as number));
  if (d.previous_expiry !== undefined && d.ends_at)
    parts.push(
      `expiry ${d.previous_expiry ? fmtDateTime(d.previous_expiry as string) : "none"} → ${fmtDateTime(d.ends_at as string)}`,
    );
  if (d.role) parts.push(String(d.role));
  if (d.reason) parts.push(`“${d.reason}”`);
  if (d.note) parts.push(`“${d.note}”`);
  return parts.join(" · ");
}

function Logs() {
  const [page, setPage] = useState(0);
  const q = useQuery({ ...auditQuery(null, page), placeholderData: (p) => p });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / 30));
  return (
    <div className="animate-rise">
      <PageHeader
        title="Activity logs"
        description="Every membership change, payment decision and role change."
      />
      <section className="panel">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data?.rows.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul>
            {q.data?.rows.map((a) => {
              const actor = q.data.people.get(a.actor_id ?? "");
              const member = q.data.people.get(a.member_id ?? "");
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 border-b px-5 py-3 text-sm last:border-0 sm:flex-row sm:gap-4"
                >
                  <span className="w-40 shrink-0 text-xs text-muted-foreground tabular sm:pt-0.5">
                    {fmtDateTime(a.created_at)}
                  </span>
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{actor?.full_name ?? "System"}</span>{" "}
                      {ACTION[a.action] ?? a.action}
                      {member && a.member_id !== a.actor_id && (
                        <>
                          {" for "}
                          <Link
                            to="/admin/members/$id"
                            params={{ id: member.id }}
                            className="font-medium underline underline-offset-4"
                          >
                            {member.full_name}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summary(a.details as Record<string, unknown>)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label="Previous"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
              aria-label="Next"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
