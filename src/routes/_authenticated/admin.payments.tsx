import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  approvePayment,
  memberStatusQuery,
  paymentQueueQuery,
  plansQuery,
  receiptUrl,
  reviewPayment,
} from "@/lib/api";
import { describeDuration } from "@/lib/membership";
import { errMessage, fmtDate, fmtDateTime, fmtLongDate, naira, relative } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  validateSearch: z.object({
    id: z.string().uuid().optional(),
    tab: z.enum(["open", "approved", "rejected", "all"]).optional(),
  }),
  head: () => ({ meta: [{ title: "Payment verification — OGV Gym staff" }] }),
  component: Payments,
});

type Row = Awaited<
  ReturnType<NonNullable<ReturnType<typeof paymentQueueQuery>["queryFn"]>>
>[number];

function Payments() {
  const { id, tab = "open" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/payments" });
  const list = useQuery(paymentQueueQuery(tab));
  const selected = list.data?.find((r) => r.id === id) ?? null;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Payment verification"
        description="Check each payment against the bank or payment provider before approving."
      />
      <div className="mb-4 flex gap-1">
        {(["open", "approved", "rejected", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => navigate({ search: { tab: t } })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
              tab === t ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {t === "open" ? "Awaiting review" : t}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className={cn("panel self-start", selected && "hidden lg:block")}>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <Loader2 className="mx-auto my-12 animate-spin text-muted-foreground" />
          ) : list.data?.length === 0 ? (
            <EmptyState title={tab === "open" ? "Nothing to review" : "No requests"}>
              {tab === "open" && "New renewal requests will appear here."}
            </EmptyState>
          ) : (
            <ul>
              {list.data?.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => navigate({ search: { tab, id: r.id } })}
                    className={cn(
                      "flex w-full items-center gap-3 border-b px-5 py-3.5 text-left last:border-0 hover:bg-muted/60",
                      r.id === id && "bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.member?.full_name ?? "Unknown member"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.membership_plans?.name} · {relative(r.created_at)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular">{naira(r.amount)}</span>
                    <StatusBadge status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {selected ? (
          <Review key={selected.id} row={selected} onClose={() => navigate({ search: { tab } })} />
        ) : (
          <div className="hidden rounded-xl border border-dashed lg:grid lg:place-items-center">
            <p className="py-20 text-sm text-muted-foreground">Select a request to review it.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Review({ row, onClose }: { row: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const plans = useQuery(plansQuery(true));
  const [planId, setPlanId] = useState(row.plan_id);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [urlErr, setUrlErr] = useState("");
  const open = row.status === "pending" || row.status === "clarification";
  const plan = plans.data?.find((p) => p.id === planId);
  const { data: current } = useQuery(memberStatusQuery(row.member_id));

  useEffect(() => {
    if (row.receipt_path)
      receiptUrl(row.receipt_path)
        .then(setUrl)
        .catch((e) => setUrlErr(errMessage(e)));
  }, [row.receipt_path]);

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries();
  };
  const approve = useMutation({
    mutationFn: () => approvePayment(row.id, planId),
    onSuccess: (r) => {
      setConfirm(false);
      done(`Approved — membership valid until ${fmtLongDate(r.ends_at)}`);
    },
    onError: (e) => {
      setConfirm(false);
      toast.error(errMessage(e));
      qc.invalidateQueries();
    },
  });
  const review = useMutation({
    mutationFn: (d: "rejected" | "clarification") => reviewPayment(row.id, d, note.trim()),
    onSuccess: (_r, d) => done(d === "rejected" ? "Payment rejected" : "Clarification requested"),
    onError: (e) => toast.error(errMessage(e)),
  });
  const isPdf = row.receipt_path?.endsWith(".pdf");

  return (
    <section className="panel self-start">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="font-medium">{row.member?.full_name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{row.member?.member_code}</span> · {row.member?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Amount claimed</dt>
          <dd className="mt-0.5 font-display text-xl font-semibold tabular">{naira(row.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Requested plan</dt>
          <dd className="mt-0.5 font-medium">{row.membership_plans?.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Payment date</dt>
          <dd className="mt-0.5">{fmtDate(row.paid_on)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reference</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">{row.reference || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Submitted</dt>
          <dd className="mt-0.5">{fmtDateTime(row.created_at)}</dd>
        </div>
        {current && (
          <div>
            <dt className="text-xs text-muted-foreground">Current membership</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <StatusBadge status={current.status} />
              <span className="text-xs tabular">{fmtDate(current.expires_at)}</span>
            </dd>
          </div>
        )}
        {row.note && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Member's note</dt>
            <dd className="mt-0.5 whitespace-pre-line">{row.note}</dd>
          </div>
        )}
        {row.review_note && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Review note</dt>
            <dd className="mt-0.5">{row.review_note}</dd>
          </div>
        )}
      </dl>

      <div className="border-t px-5 py-4">
        <p className="eyebrow mb-2">Evidence</p>
        {!row.receipt_path ? (
          <p className="text-sm text-muted-foreground">No receipt attached.</p>
        ) : urlErr ? (
          <p className="text-sm text-danger">{urlErr}</p>
        ) : !url ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : isPdf ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
          >
            <FileText className="size-4" /> Open PDF receipt <ExternalLink className="size-3" />
          </a>
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt="Payment receipt"
              className="max-h-96 w-full rounded-md border bg-muted object-contain"
            />
          </a>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          A receipt is not proof of payment. Confirm the credit in the receiving account.
        </p>
      </div>

      {open && (
        <div className="space-y-4 border-t px-5 py-4">
          <div>
            <Label>Approve as plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {naira(p.price)} ·{" "}
                    {describeDuration(p.duration_unit, p.duration_value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plan && Number(plan.price) !== Number(row.amount) && (
              <p className="mt-1.5 text-xs text-warning-foreground">
                Amount claimed ({naira(row.amount)}) differs from the plan price (
                {naira(plan.price)}).
              </p>
            )}
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="brand"
            onClick={() => setConfirm(true)}
            disabled={approve.isPending || review.isPending}
          >
            Approve payment
          </Button>
          <div>
            <Label>Reason or question for the member</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={note.trim().length < 3 || review.isPending}
              onClick={() => review.mutate("clarification")}
            >
              Ask for clarification
            </Button>
            <Button
              variant="destructive"
              disabled={note.trim().length < 3 || review.isPending}
              onClick={() => review.mutate("rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
      {!open && (
        <div className="border-t px-5 py-4 text-sm text-muted-foreground">
          {row.status === "approved" ? "Approved" : "Rejected"} {fmtDateTime(row.reviewed_at)}.{" "}
          <Link
            to="/admin/members/$id"
            params={{ id: row.member_id }}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Open member
          </Link>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve and update membership?</AlertDialogTitle>
            <AlertDialogDescription>
              You confirm that {naira(row.amount)} was received. {row.member?.full_name}'s
              membership will be activated or extended by{" "}
              {plan
                ? describeDuration(plan.duration_unit, plan.duration_value)
                : "the selected plan"}
              . This can only happen once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approve.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                approve.mutate();
              }}
              disabled={approve.isPending}
            >
              {approve.isPending && <Loader2 className="animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
