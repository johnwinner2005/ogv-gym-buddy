import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  auditQuery,
  grantPeriod,
  meQuery,
  memberPaymentsQuery,
  memberProfileQuery,
  memberStatusQuery,
  myPeriodsQuery,
  plansQuery,
  previewPeriod,
  setAccessState,
} from "@/lib/api";
import type { DurationUnit } from "@/lib/membership";
import { errMessage, fmtDate, fmtDateTime, fmtLongDate, naira } from "@/lib/format";
import { EmptyState, ErrorState, StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/members/$id")({
  head: () => ({ meta: [{ title: "Member — OGV Gym staff" }] }),
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const { data: me } = useQuery(meQuery);
  const profile = useQuery(memberProfileQuery(id));
  const p = profile.data?.profile;
  const { data: status } = useQuery(memberStatusQuery(id));
  const periods = useQuery(myPeriodsQuery(id));
  const payments = useQuery({ ...memberPaymentsQuery(id), enabled: !!me?.isAdmin });
  const audit = useQuery({ ...auditQuery(id, 0), enabled: !!me?.isAdmin });
  const [dialog, setDialog] = useState<null | "grant" | "suspend" | "cancel" | "restore">(null);

  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (profile.isLoading)
    return <Loader2 className="mx-auto mt-20 animate-spin text-muted-foreground" />;
  if (!p) return <EmptyState title="Member not found" />;

  return (
    <div className="animate-rise">
      <Link
        to="/admin/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Members
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold sm:text-[28px]">
              {p.full_name || "Unnamed member"}
            </h1>
            {status && <StatusBadge status={status.status} className="text-sm" />}
            {profile.data?.roles
              .filter((r) => r !== "member")
              .map((r) => (
                <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                  {r}
                </span>
              ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{p.member_code}</span> · {p.email} · {p.phone} · joined{" "}
            {fmtDate(p.created_at)}
          </p>
        </div>
        {me?.isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog("grant")}>
              {status?.status === "none"
                ? "Activate membership"
                : status?.status === "active"
                  ? "Extend membership"
                  : "Reactivate"}
            </Button>
            {p.access_state === "normal" ? (
              <>
                <Button variant="outline" onClick={() => setDialog("suspend")}>
                  Suspend
                </Button>
                <Button variant="ghost" onClick={() => setDialog("cancel")}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setDialog("restore")}>
                Lift {p.access_state === "suspended" ? "suspension" : "cancellation"}
              </Button>
            )}
          </div>
        )}
      </div>

      {p.access_reason && (
        <p className="mt-4 rounded-md border border-suspended/25 bg-suspended-soft px-4 py-3 text-sm text-suspended">
          {p.access_state === "suspended" ? "Suspended" : "Cancelled"}: {p.access_reason}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="border-b px-5 py-4 font-medium">Membership periods</h2>
          {periods.data?.length ? (
            <ul>
              {periods.data.map((x) => (
                <li key={x.id} className="border-b px-5 py-3.5 last:border-0">
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-medium">{x.plan_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {x.source === "payment" ? "Payment" : "Manual"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground tabular">
                    {fmtDateTime(x.starts_at)} → {fmtDateTime(x.ends_at)}
                  </p>
                  {x.reason && x.source === "manual" && <p className="mt-1 text-xs">{x.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Never activated">This account has no membership periods.</EmptyState>
          )}
        </section>

        {me?.isAdmin && (
          <section className="panel">
            <h2 className="border-b px-5 py-4 font-medium">Payment requests</h2>
            {payments.data?.length ? (
              <ul>
                {payments.data.map((x) => (
                  <li key={x.id}>
                    <Link
                      to="/admin/payments"
                      search={{ id: x.id }}
                      className="flex items-center gap-3 border-b px-5 py-3.5 last:border-0 hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium tabular">
                          {naira(x.amount)} · {x.membership_plans?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDateTime(x.created_at)}</p>
                      </div>
                      <StatusBadge status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payment requests" />
            )}
          </section>
        )}

        {me?.isAdmin && (
          <section className="panel lg:col-span-2">
            <h2 className="border-b px-5 py-4 font-medium">Activity</h2>
            {audit.data?.rows.length ? (
              <ul>
                {audit.data.rows.map((a) => (
                  <li key={a.id} className="flex gap-4 border-b px-5 py-3 text-sm last:border-0">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground tabular">
                      {fmtDateTime(a.created_at)}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        by {audit.data.people.get(a.actor_id ?? "")?.full_name ?? "system"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No activity yet" />
            )}
          </section>
        )}
      </div>

      <GrantDialog open={dialog === "grant"} onClose={() => setDialog(null)} memberId={id} />
      <AccessDialog
        state={
          dialog === "suspend"
            ? "suspended"
            : dialog === "cancel"
              ? "cancelled"
              : dialog === "restore"
                ? "normal"
                : null
        }
        onClose={() => setDialog(null)}
        memberId={id}
      />
    </div>
  );
}

function GrantDialog({
  open,
  onClose,
  memberId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
}) {
  const qc = useQueryClient();
  const plans = useQuery(plansQuery(true));
  const [plan, setPlan] = useState<string>("custom");
  const [unit, setUnit] = useState<DurationUnit>("days");
  const [value, setValue] = useState("7");
  const [reason, setReason] = useState("");
  const sel = plans.data?.find((p) => p.id === plan);
  const u = sel?.duration_unit ?? unit;
  const v = sel?.duration_value ?? Number(value);
  const valid = Number.isInteger(v) && v > 0 && v <= 3660;

  const preview = useQuery({
    queryKey: ["preview", memberId, u, v],
    queryFn: () => previewPeriod(memberId, u, v),
    enabled: open && valid,
  });
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const m = useMutation({
    mutationFn: () => grantPeriod(memberId, sel ? sel.id : null, u, v, reason.trim()),
    onSuccess: (r) => {
      toast.success(`Membership valid until ${fmtLongDate(r.ends_at)}`);
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate or extend membership</DialogTitle>
          <DialogDescription>
            Use this for walk-in payments, promotions or corrections. The change is logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {!p.is_active && "(inactive)"}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!sel && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Length</Label>
                <Input
                  className="mt-1.5"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={unit} onValueChange={(x) => setUnit(x as DurationUnit)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Calendar months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div>
            <Label>Reason</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cash payment at desk, receipt #482"
            />
          </div>
          <div className="rounded-md bg-muted px-4 py-3 text-sm">
            {preview.isLoading ? (
              "Calculating…"
            ) : preview.data ? (
              <>
                <p>
                  Current expiry:{" "}
                  <span className="font-medium">
                    {preview.data.current_expiry
                      ? fmtDateTime(preview.data.current_expiry)
                      : "none"}
                  </span>
                </p>
                <p className="mt-1">
                  New period:{" "}
                  <span className="font-medium">{fmtDateTime(preview.data.starts_at)}</span> →{" "}
                  <span className="font-medium">{fmtDateTime(preview.data.ends_at)}</span>
                </p>
              </>
            ) : (
              "Enter a valid duration"
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={!valid || reason.trim().length < 3 || m.isPending}
          >
            {m.isPending && <Loader2 className="animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({
  state,
  onClose,
  memberId,
}: {
  state: "suspended" | "cancelled" | "normal" | null;
  onClose: () => void;
  memberId: string;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [state]);
  const m = useMutation({
    mutationFn: () => setAccessState(memberId, state!, reason.trim()),
    onSuccess: () => {
      toast.success(
        state === "normal"
          ? "Access restored"
          : state === "suspended"
            ? "Membership suspended"
            : "Membership cancelled",
      );
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const title =
    state === "suspended"
      ? "Suspend membership?"
      : state === "cancelled"
        ? "Cancel membership?"
        : "Restore access?";
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state === "normal"
              ? "The member's access will follow their membership dates again."
              : "Entry will be denied immediately, even if the expiry date is in the future. The member will see the reason."}
          </DialogDescription>
        </DialogHeader>
        {state !== "normal" && (
          <div>
            <Label>Reason</Label>
            <Textarea
              className="mt-1.5"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={state === "normal" ? "default" : "destructive"}
            onClick={() => m.mutate()}
            disabled={m.isPending || (state !== "normal" && reason.trim().length < 3)}
          >
            {m.isPending && <Loader2 className="animate-spin" />}
            {state === "normal"
              ? "Restore"
              : state === "suspended"
                ? "Suspend"
                : "Cancel membership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
