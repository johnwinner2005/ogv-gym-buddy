import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { membersQuery } from "@/lib/api";
import { ErrorState, PageHeader } from "@/components/status";
import { MemberTable } from "@/components/member-table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/members/")({
  head: () => ({ meta: [{ title: "Members — OGV Gym staff" }] }),
  component: Members,
});

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["expiring", "Expiring soon"],
  ["expired", "Expired"],
  ["none", "Not activated"],
  ["suspended", "Suspended"],
  ["cancelled", "Cancelled"],
] as const;

function Members() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useQuery(membersQuery(debounced, status, page));

  return (
    <div className="animate-rise">
      <PageHeader title="Members" description="Search the directory and open a profile to manage a membership." />
      <div className="panel">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or member ID" className="pl-9" />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setStatus(k);
                  setPage(0);
                }}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  status === k ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <MemberTable rows={list.data} loading={list.isLoading} page={page} pageSize={20} onPage={setPage} />
        )}
      </div>
    </div>
  );
}
