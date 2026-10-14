import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { plansQuery, savePlan, type Plan } from "@/lib/api";
import { describeDuration, type DurationUnit } from "@/lib/membership";
import { errMessage, naira } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Membership plans — OGV Gym staff" }] }),
  component: Plans,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name the plan").max(60),
  price: z.coerce.number().min(0, "Price can't be negative").max(100_000_000),
  duration_value: z.coerce.number().int("Whole numbers only").min(1).max(3660),
  duration_unit: z.enum(["days", "months"]),
  description: z.string().trim().max(300),
  terms: z.string().trim().max(1000),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(999),
});

type Form = { id?: string; name: string; price: string; duration_value: string; duration_unit: DurationUnit; description: string; terms: string; is_active: boolean; sort_order: string };
const blank: Form = { name: "", price: "", duration_value: "30", duration_unit: "days", description: "", terms: "", is_active: true, sort_order: "0" };

function Plans() {
  const qc = useQueryClient();
  const plans = useQuery(plansQuery(true));
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const p = schema.safeParse(form);
      if (!p.success) throw new Error(p.error.issues[0].message);
      await savePlan({ ...p.data, id: form?.id });
    },
    onSuccess: () => {
      toast.success("Plan saved");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setForm(null);
    },
    onError: (e) => setErr(errMessage(e)),
  });

  const edit = (p: Plan) =>
    setForm({ ...p, price: String(p.price), duration_value: String(p.duration_value), sort_order: String(p.sort_order) });

  return (
    <div className="animate-rise">
      <PageHeader
        title="Membership plans"
        description="Prices and durations are used for renewals and approvals. Deactivate a plan to hide it — history is kept."
        actions={
          <Button onClick={() => { setErr(""); setForm(blank); }}>
            <Plus /> New plan
          </Button>
        }
      />
      <section className="panel">
        {plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        ) : plans.data?.length === 0 ? (
          <EmptyState title="No plans yet">Create your first plan so members can renew.</EmptyState>
        ) : (
          <ul>
            {plans.data?.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 border-b px-5 py-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.name} {!p.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{describeDuration(p.duration_unit, p.duration_value)} · {p.description}</p>
                </div>
                <p className="font-display text-lg font-semibold tabular">{naira(p.price)}</p>
                <Button variant="outline" size="sm" onClick={() => { setErr(""); edit(p); }}>Edit</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setErr("");
                save.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Price (₦)</Label>
                  <Input className="mt-1.5 tabular" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <Label>Display order</Label>
                  <Input className="mt-1.5" inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                </div>
                <div>
                  <Label>Duration</Label>
                  <Input className="mt-1.5" inputMode="numeric" value={form.duration_value} onChange={(e) => setForm({ ...form, duration_value: e.target.value })} />
                </div>
                <div>
                  <Label>Counted in</Label>
                  <Select value={form.duration_unit} onValueChange={(v) => setForm({ ...form, duration_unit: v as DurationUnit })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Fixed days</SelectItem>
                      <SelectItem value="months">Calendar months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                30 days and 1 calendar month differ: 15 Jan + 30 days = 14 Feb, but + 1 month = 15 Feb.
              </p>
              <div>
                <Label>Description</Label>
                <Input className="mt-1.5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Terms or restrictions</Label>
                <Textarea className="mt-1.5" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
              </div>
              <label className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
                Available for renewal
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </label>
              {err && <p className="text-sm text-danger">{err}</p>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="animate-spin" />}
                  Save plan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
