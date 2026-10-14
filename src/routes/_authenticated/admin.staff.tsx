import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { searchMembers, setRole, staffQuery } from "@/lib/api";
import { createStaffAccount } from "@/lib/accounts.functions";
import { normaliseNigerianPhone } from "@/lib/validation";
import { errMessage } from "@/lib/format";
import { PageHeader } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin");
    if (!data?.length) throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [{ title: "Staff accounts — OGV Gym" }] }),
  component: StaffPage,
});

const ROLE_LABEL = { super_admin: "Super admin", admin: "Admin", reception: "Reception" } as const;

function StaffPage() {
  const qc = useQueryClient();
  const staff = useQuery(staffQuery);
  const m = useMutation({
    mutationFn: (a: { id: string; role: "admin" | "reception"; grant: boolean }) =>
      setRole(a.id, a.role, a.grant),
    onSuccess: () => {
      toast.success("Staff access updated");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div className="max-w-3xl animate-rise">
      <PageHeader
        title="Staff accounts"
        description="Only you, the super admin, can give or remove admin access."
      />
      <section className="panel p-5">
        <h2 className="font-medium">Current staff</h2>
        <ul className="stagger mt-4 divide-y">
          {staff.data?.map((p) => {
            const isSuper = p.roles.includes("super_admin");
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    {isSuper && <Crown className="size-3.5 text-brand" />}
                    {p.full_name || p.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.email} ·{" "}
                    {isSuper
                      ? ROLE_LABEL.super_admin
                      : p.roles
                          .filter((r) => r !== "member")
                          .map((r) => ROLE_LABEL[r as keyof typeof ROLE_LABEL])
                          .join(", ")}
                  </p>
                </div>
                {!isSuper &&
                  (["admin", "reception"] as const).map((r) =>
                    p.roles.includes(r) ? (
                      <Button
                        key={r}
                        size="sm"
                        variant="outline"
                        disabled={m.isPending}
                        onClick={() => {
                          if (confirm(`Remove ${ROLE_LABEL[r]} access from ${p.full_name}?`))
                            m.mutate({ id: p.id, role: r, grant: false });
                        }}
                      >
                        Remove {ROLE_LABEL[r].toLowerCase()}
                      </Button>
                    ) : null,
                  )}
              </li>
            );
          })}
        </ul>
      </section>
      <Promote onGrant={(id, role) => m.mutate({ id, role, grant: true })} />
      <CreateAccount />
    </div>
  );
}

function Promote({ onGrant }: { onGrant: (id: string, role: "admin" | "reception") => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchMembers>>>([]);
  return (
    <section className="panel mt-6 p-5">
      <h2 className="font-medium">Give access to an existing account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        For someone who has already registered. They sign in as usual and land on the staff area.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setResults(await searchMembers(q));
          } catch (err) {
            toast.error(errMessage(err));
          }
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find by email or name"
          />
        </div>
        <Button type="submit" variant="outline">
          Find
        </Button>
      </form>
      <div className="stagger">
        {results.map((r) => (
          <div
            key={r.id}
            className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted px-4 py-2.5 text-sm"
          >
            <span className="flex-1">
              {r.full_name} · {r.email}
            </span>
            <Button size="sm" variant="outline" onClick={() => onGrant(r.id, "reception")}>
              Make reception
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirm(`Give ${r.full_name} full admin access?`)) onGrant(r.id, "admin");
              }}
            >
              Make admin
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateAccount() {
  const qc = useQueryClient();
  const create = useServerFn(createStaffAccount);
  const empty = { full_name: "", email: "", phone: "", password: "", role: "admin" as const };
  const [f, setF] = useState<{
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: "admin" | "reception";
  }>(empty);
  const m = useMutation({
    mutationFn: () => {
      if (!normaliseNigerianPhone(f.phone))
        throw new Error("Enter a valid 11-digit Nigerian mobile number");
      if (f.password.length < 8 || !/[0-9]/.test(f.password))
        throw new Error("Password needs at least 8 characters and one number");
      return create({ data: f });
    },
    onSuccess: () => {
      toast.success(`Account created for ${f.email}`);
      setF(empty);
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
  return (
    <section className="panel mt-6 p-5">
      <h2 className="flex items-center gap-2 font-medium">
        <UserPlus className="size-4" /> Create a new staff account
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The account is ready to use straight away. Share the password privately and ask them to
        change it from their profile.
      </p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {(
          [
            ["full_name", "Full name", "text"],
            ["email", "Email", "email"],
            ["phone", "Phone number", "tel"],
            ["password", "Temporary password", "text"],
          ] as const
        ).map(([k, label, type]) => (
          <div key={k}>
            <Label htmlFor={`s-${k}`}>{label}</Label>
            <Input
              id={`s-${k}`}
              type={type}
              required
              className="mt-1.5"
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              placeholder={k === "phone" ? "08031234567" : undefined}
            />
          </div>
        ))}
        <div>
          <Label>Access</Label>
          <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as typeof f.role })}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin — full management</SelectItem>
              <SelectItem value="reception">Reception — verify and check in only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={m.isPending} className="w-full">
            {m.isPending && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </div>
      </form>
    </section>
  );
}
