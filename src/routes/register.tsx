import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkEmail } from "@/lib/accounts.functions";
import { emailProblem, normaliseNigerianPhone } from "@/lib/validation";
import { AuthLayout, FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — OGV Gym" },
      { name: "description", content: "Register for an OGV Gym member account." },
      { property: "og:title", content: "Create account — OGV Gym" },
      { property: "og:description", content: "Register for an OGV Gym member account." },
    ],
  }),
  component: Register,
});

const schema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z
      .string()
      .trim()
      .max(255)
      .superRefine((v, ctx) => {
        const p = emailProblem(v);
        if (p) ctx.addIssue({ code: "custom", message: p });
      }),
    phone: z
      .string()
      .trim()
      .refine((v) => normaliseNigerianPhone(v) !== null, {
        message: "Enter a valid 11-digit Nigerian mobile number, e.g. 08031234567",
      }),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128)
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

function Register() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    const ec = await checkEmail({ data: { email: parsed.data.email } }).catch(() => ({
      ok: true,
      message: "",
    }));
    if (!ec.ok) {
      setLoading(false);
      setErrors({ email: ec.message });
      return;
    }
    const phone = normaliseNigerianPhone(parsed.data.phone)!;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { full_name: parsed.data.full_name, phone },
      },
    });
    setLoading(false);
    if (error) {
      setFormError(
        /registered|exists/i.test(error.message)
          ? "An account with this email already exists. Sign in instead."
          : error.message,
      );
      return;
    }
    // An existing email returns a user with no identities (no error, by design).
    if (data.user && data.user.identities?.length === 0) {
      setFormError("An account with this email already exists. Sign in or reset your password.");
      return;
    }
    if (data.session) {
      window.location.assign("/app");
      return;
    }
    setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}.`}>
        <div className="panel flex gap-3 p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-brand" />
          <p className="text-muted-foreground">
            Open the link to confirm your account, then sign in. Your account isn't a gym membership
            yet — the front desk activates your plan once payment is verified.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/auth">Back to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register once. Your membership is activated by the gym after payment is verified."
      footer={
        <>
          Already registered?{" "}
          <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {(
          [
            ["full_name", "Full name", "text", "name"],
            ["email", "Email", "email", "email"],
            ["phone", "Phone number", "tel", "tel"],
            ["password", "Password", "password", "new-password"],
            ["confirm", "Confirm password", "password", "new-password"],
          ] as const
        ).map(([k, label, type, ac]) => (
          <div key={k}>
            <Label htmlFor={k}>{label}</Label>
            <Input
              id={k}
              type={type}
              autoComplete={ac}
              className="mt-1.5 h-11"
              value={form[k]}
              onChange={set(k)}
              aria-invalid={!!errors[k]}
              placeholder={k === "phone" ? "08031234567" : undefined}
              maxLength={k === "phone" ? 14 : undefined}
              inputMode={k === "phone" ? "tel" : undefined}
            />
            <FieldError>{errors[k]}</FieldError>
          </div>
        ))}
        {formError && (
          <p
            role="alert"
            className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
