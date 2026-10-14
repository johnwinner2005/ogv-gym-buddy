import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — OGV Gym" },
      { name: "description", content: "Recover access to your OGV Gym account." },
      { property: "og:title", content: "Reset password — OGV Gym" },
      { property: "og:description", content: "Recover access to your OGV Gym account." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = z.string().trim().email().safeParse(email);
    if (!p.success) return setError("Enter a valid email address");
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(p.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error)
      return setError(
        error.status === 429 ? "Too many requests. Try again shortly." : error.message,
      );
    setSent(true);
  }

  return (
    <AuthLayout
      title={sent ? "Check your email" : "Forgot your password?"}
      subtitle={
        sent
          ? "If an account exists for that email, a reset link is on its way."
          : "Enter your account email and we'll send a reset link."
      }
      footer={
        <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="mt-1.5 h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{error}</FieldError>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
