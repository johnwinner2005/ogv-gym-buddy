import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { meQuery, memberPaymentsQuery, myPeriodsQuery, respondClarification } from "@/lib/api";
import { errMessage, fmtDate, fmtDateTime, naira } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/history")({
  head: () => ({ meta: [{ title: "Payments & history — OGV Gym" }] }),
  component: History,
});

function History() {
  const { data: me } = useQuery(meQuery);
  const uid = me?.user.id ?? "";
  const payments = useQuery({ ...memberPaymentsQuery(uid), enabled: !!uid });
  const periods = useQuery({ ...myPeriodsQuery(uid), enabled: !!uid });

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader title="Payments & history" />
      <section className="panel">
        <h2 className="border-b px-5 py-4 font-medium">Payment requests</h2>
        {payments.isError ? (
          <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
        ) : payments.data?.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <ul>
            {payments.data?.map((p) => (
              <li key={p.id} className="border-b px-5 py-4 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular">
                      {naira(p.amount)} · {p.membership_plans?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {fmtDateTime(p.created_at)}
                      {p.reference && <> · Ref {p.reference}</>}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.review_note && (
                  <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">From the gym: </span>
                    {p.review_note}
                  </p>
                )}
                {p.status === "clarification" && <Reply id={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="border-b px-5 py-4 font-medium">Membership periods</h2>
        {periods.data?.length === 0 ? (
          <EmptyState title="No membership periods yet" />
        ) : (
          <ul>
            {periods.data?.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.plan_name}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {fmtDate(p.starts_at)} – {fmtDateTime(p.ends_at)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {p.source === "payment" ? "Paid renewal" : "Set by gym"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Reply({ id }: { id: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => respondClarification(id, note.trim()),
    onSuccess: () => {
      toast.success("Reply sent — your request is back in the review queue");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Your reply to the gym"
        maxLength={800}
      />
      <Button onClick={() => m.mutate()} disabled={note.trim().length < 2 || m.isPending}>
        {m.isPending && <Loader2 className="animate-spin" />}
        Send reply
      </Button>
    </div>
  );
}
