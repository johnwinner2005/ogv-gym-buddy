import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MemberListRow } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function MemberTable({
  rows,
  loading,
  page,
  pageSize,
  onPage,
  emptyTitle = "No members found",
}: {
  rows?: MemberListRow[];
  loading?: boolean;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  emptyTitle?: string;
}) {
  const total = rows?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (loading && !rows)
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  if (!rows?.length) return <EmptyState title={emptyTitle} />;
  return (
    <>
      {/* Desktop table */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">Member</th>
            <th className="px-3 py-3 font-medium">Contact</th>
            <th className="px-3 py-3 font-medium">Plan</th>
            <th className="px-3 py-3 font-medium">Expiry</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="px-5 py-3">
                <Link
                  to="/admin/members/$id"
                  params={{ id: m.id }}
                  className="font-medium hover:underline"
                >
                  {m.full_name || "—"}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{m.member_code}</p>
              </td>
              <td className="px-3 py-3">
                <p className="truncate">{m.email}</p>
                <p className="text-xs text-muted-foreground">{m.phone}</p>
              </td>
              <td className="px-3 py-3">
                {m.plan_name ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-3 tabular">{fmtDate(m.expires_at)}</td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={m.status} />
                  {m.pending_requests > 0 && <StatusBadge status="pending" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile cards */}
      <ul className="md:hidden">
        {rows.map((m) => (
          <li key={m.id}>
            <Link
              to="/admin/members/$id"
              params={{ id: m.id }}
              className="block border-b px-4 py-3.5 last:border-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-medium">{m.full_name || "—"}</p>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{m.member_code}</span> · {m.plan_name ?? "No plan"} ·{" "}
                {fmtDate(m.expires_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>
          {total} member{total === 1 ? "" : "s"} · page {page + 1} of {pages}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page + 1 >= pages}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}
