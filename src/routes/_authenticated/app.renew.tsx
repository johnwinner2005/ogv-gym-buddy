import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Check, Info, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { meQuery, myStatusQuery, plansQuery, settingsQuery, submitPaymentRequest } from "@/lib/api";
import { addDuration, describeDuration, nextPeriodStart } from "@/lib/membership";
import { errMessage, fmtLongDate, naira } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/status";
import { FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/renew")({
  head: () => ({ meta: [{ title: "Renew membership — OGV Gym" }] }),
  component: Renew,
});

const MAX = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic"];

const schema = z.object({
  amount: z.coerce.number().positive("Enter the amount you paid").max(100_000_000),
  reference: z.string().trim().max(120),
  paidOn: z.string().min(1, "Enter the payment date"),
  note: z.string().trim().max(1000),
});

function Renew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const plans = useQuery(plansQuery());
  const { data: settings } = useQuery(settingsQuery);
  const { data: status } = useQuery(myStatusQuery);
  const [planId, setPlanId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", reference: "", paidOn: new Date().toISOString().slice(0, 10), note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plan = plans.data?.find((p) => p.id === planId);

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      const errs: Record<string, string> = {};
      if (!parsed.success) parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      if (!plan) errs.plan = "Choose a plan";
      if (!file) errs.file = "Attach your receipt or transfer screenshot";
      else if (file.size > MAX) errs.file = "File must be 8 MB or smaller";
      else if (!TYPES.includes(file.type)) errs.file = "Use a JPG, PNG, WEBP, HEIC or PDF file";
      if (parsed.success && new Date(parsed.data.paidOn) > new Date()) errs.paidOn = "Payment date can't be in the future";
      setErrors(errs);
      if (Object.keys(errs).length || !parsed.success) throw new Error("validation");
      await submitPaymentRequest({
        memberId: me!.user.id,
        planId: plan!.id,
        amount: parsed.data.amount,
        reference: parsed.data.reference,
        paidOn: parsed.data.paidOn,
        note: parsed.data.note,
        file,
      });
    },
    onSuccess: () => {
      toast.success("Renewal submitted for verification");
      qc.invalidateQueries();
      navigate({ to: "/app" });
    },
    onError: (e) => {
      if ((e as Error).message !== "validation") toast.error(errMessage(e));
    },
  });

  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => plans.refetch()} />;

  // Preview only; the server computes the real dates on approval.
  const periods = status?.expires_at ? [{ starts_at: status.starts_at!, ends_at: status.expires_at }] : [];
  const start = plan ? nextPeriodStart(periods, settings?.renewal_rule ?? "from_expiry") : null;
  const end = plan && start ? addDuration(start, plan.duration_unit, plan.duration_value, settings?.timezone) : null;

  return (
    <div className="animate-rise">
      <PageHeader title="Renew membership" description="Choose a plan, pay using the instructions below, then submit your receipt." />

      {status?.status === "suspended" && (
        <p className="mb-6 rounded-md border border-suspended/25 bg-suspended-soft px-4 py-3 text-sm text-suspended">
          Your membership is suspended. A renewal can be reviewed, but entry stays blocked until an administrator lifts the
          suspension.
        </p>
      )}

      <section>
        <p className="eyebrow mb-3">1 · Choose a plan</p>
        {plans.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : plans.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {plans.data.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={planId === p.id}
                onClick={() => {
                  setPlanId(p.id);
                  setForm((f) => ({ ...f, amount: String(p.price) }));
                }}
                className={cn(
                  "panel relative p-5 text-left transition-colors hover:border-foreground/30",
                  planId === p.id && "border-foreground ring-1 ring-foreground",
                )}
              >
                {planId === p.id && (
                  <span className="absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <p className="font-medium">{p.name}</p>
                <p className="mt-2 font-display text-2xl font-semibold tabular">{naira(p.price)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{describeDuration(p.duration_unit, p.duration_value)}</p>
                {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="panel">
            <EmptyState title="No plans available right now">Please ask the front desk.</EmptyState>
          </div>
        )}
        <FieldError>{errors.plan}</FieldError>
        {plan && end && (
          <p className="mt-3 text-sm text-muted-foreground">
            If approved today, this plan would run until about <span className="font-medium text-foreground">{fmtLongDate(end)}</span>.
            The gym confirms the final dates on approval.
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="panel p-5">
          <p className="eyebrow mb-3">2 · Pay</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {settings?.payment_instructions || "Payment instructions haven't been set yet. Please ask the front desk."}
          </p>
          {me?.profile?.member_code && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">
              Your member ID: <span className="font-mono font-medium">{me.profile.member_code}</span>
            </p>
          )}
        </section>

        <section className="panel p-5">
          <p className="eyebrow mb-4">3 · Submit evidence</p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount">Amount paid (₦)</Label>
                <Input id="amount" inputMode="decimal" className="mt-1.5 tabular" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <FieldError>{errors.amount}</FieldError>
              </div>
              <div>
                <Label htmlFor="paidOn">Payment date</Label>
                <Input id="paidOn" type="date" className="mt-1.5" value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
                <FieldError>{errors.paidOn}</FieldError>
              </div>
            </div>
            <div>
              <Label htmlFor="ref">Transfer reference <span className="text-muted-foreground">(if available)</span></Label>
              <Input id="ref" className="mt-1.5" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="file">Receipt or transfer screenshot</Label>
              <label
                htmlFor="file"
                className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 text-sm hover:bg-muted"
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="truncate">{file ? file.name : "Choose a file (JPG, PNG, PDF · max 8 MB)"}</span>
              </label>
              <input
                id="file"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <FieldError>{errors.file}</FieldError>
            </div>
            <div>
              <Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea id="note" rows={2} className="mt-1.5" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex gap-2.5 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-px size-4 shrink-0" />
              Uploading a receipt doesn't activate your membership. Staff check the payment first — you'll be notified when it's
              approved.
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="animate-spin" />}
              Submit for verification
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
