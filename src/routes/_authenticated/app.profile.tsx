import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, updateMyProfile } from "@/lib/api";
import { errMessage, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({ meta: [{ title: "Profile — OGV Gym" }] }),
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  useEffect(() => {
    if (me?.profile) {
      setName(me.profile.full_name);
      setPhone(me.profile.phone);
    }
  }, [me?.profile]);

  const save = useMutation({
    mutationFn: () => updateMyProfile(name, phone),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: async () => {
      if (pw.next.length < 8 || !/[0-9]/.test(pw.next))
        throw new Error("Use at least 8 characters including a number");
      const { error } = await supabase.auth.updateUser({
        password: pw.next,
        current_password: pw.current,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setPw({ current: "", next: "" });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (!me?.profile) return null;
  return (
    <div className="max-w-2xl animate-rise">
      <PageHeader title="Profile" />
      <section className="panel divide-y">
        {[
          ["Member ID", <span className="font-mono">{me.profile.member_code}</span>],
          ["Email", me.profile.email],
          ["Registered", fmtDate(me.profile.created_at)],
        ].map(([k, v]) => (
          <div key={k as string} className="flex justify-between px-5 py-3.5 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        To change your email address, please ask the front desk.
      </p>

      <form
        className="panel mt-6 space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-medium">Personal details</h2>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            className="mt-1.5"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
          />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </form>

      <form
        className="panel mt-6 space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          changePw.mutate();
        }}
      >
        <h2 className="font-medium">Change password</h2>
        <div>
          <Label htmlFor="cur">Current password</Label>
          <Input
            id="cur"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="new">New password</Label>
          <Input
            id="new"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={changePw.isPending || !pw.current || !pw.next}
        >
          {changePw.isPending && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  );
}
