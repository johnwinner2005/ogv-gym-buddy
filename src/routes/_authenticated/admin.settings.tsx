import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  saveSettings,
  settingsQuery,
  type Settings,
} from "@/lib/api";
import { errMessage, setGymTimezone } from "@/lib/format";
import { PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — OGV Gym staff" }] }),
  component: SettingsPage,
});

const TZ = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "UTC",
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        timezone: s!.timezone,
        renewal_rule: s!.renewal_rule,
        expiring_soon_days: Number(s!.expiring_soon_days),
        payment_instructions: s!.payment_instructions.slice(0, 2000),
        support_contact: s!.support_contact.slice(0, 300),
      }),
    onSuccess: () => {
      setGymTimezone(s!.timezone);
      toast.success("Settings saved");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div className="max-w-3xl animate-rise">
      <PageHeader title="Settings" />
      {s && (
        <form
          className="panel space-y-5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="font-medium">Membership rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Gym timezone</Label>
              <Select value={s.timezone} onValueChange={(v) => setS({ ...s, timezone: v })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TZ.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>"Expiring soon" window (days)</Label>
              <Input
                className="mt-1.5"
                inputMode="numeric"
                value={s.expiring_soon_days}
                onChange={(e) =>
                  setS({ ...s, expiring_soon_days: Number(e.target.value.replace(/\D/g, "")) || 1 })
                }
              />
            </div>
          </div>
          <div>
            <Label>Early renewal starts</Label>
            <Select
              value={s.renewal_rule}
              onValueChange={(v) => setS({ ...s, renewal_rule: v as Settings["renewal_rule"] })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="from_expiry">
                  From the current expiry date (member keeps remaining time)
                </SelectItem>
                <SelectItem value="from_approval">From the approval date</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Expired memberships always restart from the approval date.
            </p>
          </div>
          <div>
            <Label>Payment instructions shown to members</Label>
            <Textarea
              className="mt-1.5"
              rows={4}
              value={s.payment_instructions}
              onChange={(e) => setS({ ...s, payment_instructions: e.target.value })}
              placeholder="Bank name, account name and number…"
            />
          </div>
          <div>
            <Label>Support contact</Label>
            <Input
              className="mt-1.5"
              value={s.support_contact}
              onChange={(e) => setS({ ...s, support_contact: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </form>
      )}
    </div>
  );
}
