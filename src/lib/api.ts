/**
 * Data access. Every privileged operation is a SECURITY DEFINER database
 * function that checks the caller's role and runs in a single transaction;
 * the browser never writes membership or payment status directly.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DurationUnit, MembershipStatus, RenewalRule } from "./membership";

export type Role = "admin" | "reception" | "member";

export interface StatusResult {
  status: MembershipStatus | "not_found";
  member_id: string;
  member_code: string;
  full_name: string;
  email: string;
  phone: string;
  photo_url: string | null;
  access_reason: string | null;
  plan_name: string | null;
  starts_at: string | null;
  expires_at: string | null;
  pending_requests: number;
  checked_at: string;
}
export type Decision = "granted" | "expired" | "suspended" | "cancelled" | "no_membership" | "not_found";
export interface VerifyResult extends StatusResult {
  decision: Decision;
  last_verified: string | null;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  duration_unit: DurationUnit;
  duration_value: number;
  description: string;
  terms: string;
  is_active: boolean;
  sort_order: number;
}

export interface Settings {
  gym_name: string;
  timezone: string;
  renewal_rule: RenewalRule;
  expiring_soon_days: number;
  payment_instructions: string;
  support_contact: string;
}

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u, error } = await supabase.auth.getUser();
    if (error || !u.user) return null;
    const [roles, profile] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
    ]);
    const r = (roles.data ?? []).map((x) => x.role as Role);
    return {
      user: u.user,
      roles: r,
      isAdmin: r.includes("admin"),
      isStaff: r.includes("admin") || r.includes("reception"),
      profile: profile.data,
    };
  },
  staleTime: 60_000,
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => unwrap<Settings>(await supabase.from("gym_settings").select("*").eq("id", 1).single()),
  staleTime: 5 * 60_000,
});

export const myStatusQuery = queryOptions({
  queryKey: ["my-status"],
  queryFn: async () => unwrap<StatusResult>(await supabase.rpc("get_my_status")),
  refetchOnWindowFocus: true,
});

export const plansQuery = (includeInactive = false) =>
  queryOptions({
    queryKey: ["plans", includeInactive],
    queryFn: async () => {
      let q = supabase.from("membership_plans").select("*").order("sort_order").order("price");
      if (!includeInactive) q = q.eq("is_active", true);
      return unwrap<Plan[]>(await q);
    },
  });

export const myPeriodsQuery = (memberId: string) =>
  queryOptions({
    queryKey: ["periods", memberId],
    queryFn: async () =>
      unwrap<
        {
          id: string;
          plan_name: string;
          starts_at: string;
          ends_at: string;
          source: string;
          reason: string;
          previous_expiry: string | null;
          created_at: string;
        }[]
      >(
        await supabase
          .from("membership_periods")
          .select("id, plan_name, starts_at, ends_at, source, reason, previous_expiry, created_at")
          .eq("member_id", memberId)
          .order("ends_at", { ascending: false }),
      ),
  });

export interface PaymentRow {
  id: string;
  member_id: string;
  plan_id: string;
  amount: number;
  reference: string;
  paid_on: string | null;
  receipt_path: string | null;
  note: string;
  status: "pending" | "approved" | "rejected" | "clarification";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  membership_plans?: { name: string; duration_unit: DurationUnit; duration_value: number } | null;
}

export const memberPaymentsQuery = (memberId: string) =>
  queryOptions({
    queryKey: ["payments", "member", memberId],
    queryFn: async () =>
      unwrap<PaymentRow[]>(
        await supabase
          .from("payment_requests")
          .select("*, membership_plans(name, duration_unit, duration_value)")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false }),
      ),
  });

export const notificationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["notifications", userId],
    queryFn: async () =>
      unwrap<{ id: string; kind: string; title: string; body: string; read_at: string | null; created_at: string }[]>(
        await supabase
          .from("notifications")
          .select("id, kind, title, body, read_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ),
    refetchInterval: 60_000,
  });

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  unwrap(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids));
}

export async function syncMyNotices() {
  await supabase.rpc("sync_my_notices");
}

export async function updateMyProfile(full_name: string, phone: string) {
  unwrap(await supabase.rpc("update_my_profile", { _full_name: full_name, _phone: phone }));
}

export async function submitPaymentRequest(input: {
  memberId: string;
  planId: string;
  amount: number;
  reference: string;
  paidOn: string;
  note: string;
  file: File | null;
}) {
  let receipt_path: string | null = null;
  if (input.file) {
    const ext = (input.file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    receipt_path = `${input.memberId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("receipts").upload(receipt_path, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
    if (up.error) throw new Error("Receipt upload failed: " + up.error.message);
  }
  unwrap(
    await supabase.from("payment_requests").insert({
      member_id: input.memberId,
      plan_id: input.planId,
      amount: input.amount,
      reference: input.reference,
      paid_on: input.paidOn || null,
      note: input.note,
      receipt_path,
    }),
  );
}

export async function respondClarification(id: string, note: string) {
  unwrap(await supabase.rpc("respond_clarification", { _request: id, _note: note }));
}

export async function receiptUrl(path: string) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/* ---------------- Staff ---------------- */

export async function searchMembers(q: string) {
  return unwrap<
    { id: string; member_code: string; full_name: string; email: string; phone: string; photo_url: string | null }[]
  >(await supabase.rpc("search_members", { _q: q, _limit: 8 }));
}

export async function verifyMember(id: string) {
  return unwrap<VerifyResult>(await supabase.rpc("verify_member", { _member: id }));
}

export const overviewQuery = queryOptions({
  queryKey: ["admin", "overview"],
  queryFn: async () =>
    unwrap<{
      total: number;
      active: number;
      expired: number;
      none: number;
      suspended: number;
      expiring_soon: number;
      pending_payments: number;
      verifications_today: number;
      expiring_soon_days: number;
    }>(await supabase.rpc("admin_overview")),
  refetchInterval: 60_000,
});

export interface MemberListRow {
  id: string;
  member_code: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  status: MembershipStatus;
  plan_name: string | null;
  expires_at: string | null;
  pending_requests: number;
  total_count: number;
}

export const membersQuery = (q: string, status: string, page: number, pageSize = 20) =>
  queryOptions({
    queryKey: ["admin", "members", q, status, page],
    queryFn: async () =>
      unwrap<MemberListRow[]>(
        await supabase.rpc("admin_list_members", {
          _q: q,
          _status: status,
          _limit: pageSize,
          _offset: page * pageSize,
        }),
      ),
    placeholderData: (prev) => prev,
  });

export const memberProfileQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "member", id],
    queryFn: async () => {
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
      ]);
      if (profile.error) throw new Error(profile.error.message);
      return { profile: profile.data, roles: (roles.data ?? []).map((r) => r.role as Role) };
    },
  });

export const paymentQueueQuery = (status: string) =>
  queryOptions({
    queryKey: ["admin", "payments", status],
    queryFn: async () => {
      let q = supabase
        .from("payment_requests")
        .select("*, membership_plans(name, duration_unit, duration_value)")
        .order("created_at", { ascending: status === "open" });
      if (status === "open") q = q.in("status", ["pending", "clarification"]);
      else if (status !== "all") q = q.eq("status", status as PaymentRow["status"]);
      const rows = unwrap<PaymentRow[]>(await q.limit(100));
      const ids = [...new Set(rows.map((r) => r.member_id))];
      const profiles = ids.length
        ? unwrap<{ id: string; full_name: string; member_code: string; email: string }[]>(
            await supabase.from("profiles").select("id, full_name, member_code, email").in("id", ids),
          )
        : [];
      const map = new Map(profiles.map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, member: map.get(r.member_id) ?? null }));
    },
  });

export async function approvePayment(id: string, planId: string) {
  return unwrap<{ starts_at: string; ends_at: string }>(
    await supabase.rpc("approve_payment", { _request: id, _plan: planId }),
  );
}
export async function reviewPayment(id: string, decision: "rejected" | "clarification", note: string) {
  unwrap(await supabase.rpc("review_payment", { _request: id, _decision: decision, _note: note }));
}

export async function previewPeriod(memberId: string, unit: DurationUnit, value: number) {
  return unwrap<{ starts_at: string; ends_at: string; current_expiry: string | null }>(
    await supabase.rpc("preview_period", { _member: memberId, _unit: unit, _value: value }),
  );
}
export async function grantPeriod(memberId: string, planId: string | null, unit: DurationUnit, value: number, reason: string) {
  return unwrap<{ starts_at: string; ends_at: string }>(
    await supabase.rpc("admin_grant_period", {
      _member: memberId,
      _plan: planId as string,
      _unit: unit,
      _value: value,
      _reason: reason,
    }),
  );
}
export async function setAccessState(memberId: string, state: "normal" | "suspended" | "cancelled", reason: string) {
  unwrap(await supabase.rpc("admin_set_access_state", { _member: memberId, _state: state, _reason: reason }));
}
export async function setRole(userId: string, role: "admin" | "reception", grant: boolean) {
  unwrap(await supabase.rpc("admin_set_role", { _user: userId, _role: role, _grant: grant }));
}

export async function savePlan(p: Partial<Plan> & { id?: string }) {
  const body = {
    name: p.name!,
    price: p.price!,
    duration_unit: p.duration_unit!,
    duration_value: p.duration_value!,
    description: p.description ?? "",
    terms: p.terms ?? "",
    is_active: p.is_active ?? true,
    sort_order: p.sort_order ?? 0,
  };
  if (p.id) unwrap(await supabase.from("membership_plans").update(body).eq("id", p.id));
  else unwrap(await supabase.from("membership_plans").insert(body));
}

export async function saveSettings(s: Partial<Settings>) {
  unwrap(await supabase.from("gym_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1));
}

export const auditQuery = (memberId: string | null, page: number) =>
  queryOptions({
    queryKey: ["admin", "audit", memberId, page],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * 30, page * 30 + 29);
      if (memberId) q = q.eq("member_id", memberId);
      const res = await q;
      if (res.error) throw new Error(res.error.message);
      const ids = [...new Set(res.data.flatMap((r) => [r.actor_id, r.member_id]).filter(Boolean) as string[])];
      const profiles = ids.length
        ? ((await supabase.from("profiles").select("id, full_name, member_code").in("id", ids)).data ?? [])
        : [];
      return { rows: res.data, count: res.count ?? 0, people: new Map(profiles.map((p) => [p.id, p])) };
    },
  });

export const verificationLogQuery = queryOptions({
  queryKey: ["admin", "verifications"],
  queryFn: async () => {
    const res = unwrap<{ id: string; member_id: string | null; result: string; staff_id: string; created_at: string }[]>(
      await supabase.from("verification_logs").select("*").order("created_at", { ascending: false }).limit(15),
    );
    const ids = [...new Set(res.map((r) => r.member_id).filter(Boolean) as string[])];
    const profiles = ids.length
      ? ((await supabase.from("profiles").select("id, full_name, member_code").in("id", ids)).data ?? [])
      : [];
    const map = new Map(profiles.map((p) => [p.id, p]));
    return res.map((r) => ({ ...r, member: r.member_id ? map.get(r.member_id) ?? null : null }));
  },
});

export const reportsQuery = (days: number) =>
  queryOptions({
    queryKey: ["admin", "reports", days],
    queryFn: async () =>
      unwrap<{
        revenue: number;
        approved: number;
        rejected: number;
        new_members: number;
        by_plan: { name: string; count: number; revenue: number }[];
        verifications: Record<string, number>;
      }>(await supabase.rpc("admin_reports", { _days: days })),
  });

export const staffQuery = queryOptions({
  queryKey: ["admin", "staff"],
  queryFn: async () => {
    const roles = unwrap<{ user_id: string; role: Role }[]>(
      await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "reception"]),
    );
    const ids = [...new Set(roles.map((r) => r.user_id))];
    const profiles = ids.length
      ? unwrap<{ id: string; full_name: string; email: string; member_code: string }[]>(
          await supabase.from("profiles").select("id, full_name, email, member_code").in("id", ids),
        )
      : [];
    return profiles.map((p) => ({ ...p, roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role) }));
  },
});
