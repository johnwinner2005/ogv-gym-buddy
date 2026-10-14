import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailProblem, normaliseNigerianPhone } from "./validation";

async function domainReceivesMail(domain: string): Promise<boolean | null> {
  try {
    for (const type of ["MX", "A"]) {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { Status: number; Answer?: unknown[] };
      if (j.Status === 0 && j.Answer?.length) return true;
    }
    return false;
  } catch {
    return null; // lookup unavailable: don't block sign-up on our own outage
  }
}

/** Public: checks that an email's domain actually exists and accepts mail. */
export const checkEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const p = emailProblem(data.email);
    if (p) return { ok: false, message: p };
    const domain = data.email.trim().toLowerCase().split("@")[1]!;
    const ok = await domainReceivesMail(domain);
    if (ok === false)
      return { ok: false, message: "This email domain doesn't exist. Check for typos." };
    return { ok: true, message: "" };
  });

/** Super admin only: create a staff account directly. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().max(20),
        password: z.string().min(8).max(128).regex(/[0-9]/),
        role: z.enum(["admin", "reception"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Only the super admin can create staff accounts");
    const phone = normaliseNigerianPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Nigerian phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone },
    });
    if (error || !created.user)
      throw new Error(
        /registered|exists/i.test(error?.message ?? "")
          ? "An account with this email already exists — promote it instead."
          : (error?.message ?? "Could not create account"),
      );
    const { error: re } = await context.supabase.rpc("admin_set_role", {
      _user: created.user.id,
      _role: data.role,
      _grant: true,
    });
    if (re) throw new Error(re.message);
    return { id: created.user.id };
  });
