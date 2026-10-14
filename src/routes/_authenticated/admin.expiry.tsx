import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { membersQuery, overviewQuery } from "@/lib/api";
import { PageHeader } from "@/components/status";
import { MemberTable } from "@/components/member-table";

export const Route = createFileRoute("/_authenticated/admin/expiry")({
  head: () => ({ meta: [{ title: "Membership expiry — OGV Gym staff" }] }),
  component: Expiry,
});

function Expiry() {
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const ov = useQuery(overviewQuery);
  const soon = useQuery(membersQuery("", "expiring", p1, 15));
  const expired = useQuery(membersQuery("", "expired", p2, 15));
  return (
    <div className="space-y-6 animate-rise">
      <PageHeader
        title="Membership expiry"
        description="Follow up before memberships lapse, and with members who have expired."
      />
      <section className="panel">
        <h2 className="border-b px-5 py-4 font-medium">
          Expiring in the next {ov.data?.expiring_soon_days ?? "…"} days
        </h2>
        <MemberTable
          rows={soon.data}
          loading={soon.isLoading}
          page={p1}
          pageSize={15}
          onPage={setP1}
          emptyTitle="Nobody is expiring soon"
        />
      </section>
      <section className="panel">
        <h2 className="border-b px-5 py-4 font-medium">Expired</h2>
        <MemberTable
          rows={expired.data}
          loading={expired.isLoading}
          page={p2}
          pageSize={15}
          onPage={setP2}
          emptyTitle="No expired memberships"
        />
      </section>
    </div>
  );
}
