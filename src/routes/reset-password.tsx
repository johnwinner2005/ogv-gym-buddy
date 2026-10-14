import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — OGV Gym" },
      { name: "description", content: "Set a new password for your OGV Gym account." },
      { property: "og:title", content: "Choose a new password — OGV Gym" },
      { property: "og:description", content: "Set a new password for your OGV Gym account." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setReady(true);
      else if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8 || !/[0-9]/.test(pw))
      return setError("Use at least 8 characters including a number");
    if (pw !== confirm) return setError("Passwords don't match");
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setError(error.message);
    toast.success("Password updated");
    navigate({ to: "/app", replace: true });
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={ready ? undefined : "Open this page from the link in your reset email."}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="pw">New password</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="new-password"
            className="mt-1.5 h-11"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={!ready}
          />
        </div>
        <div>
          <Label htmlFor="pw2">Confirm password</Label>
          <Input
            id="pw2"
            type="password"
            autoComplete="new-password"
            className="mt-1.5 h-11"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={!ready}
          />
          <FieldError>{error}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading || !ready}>
          {loading && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
