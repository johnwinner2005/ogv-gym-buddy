/**
 * Pure membership rules. The database functions (compute_status, add_duration,
 * next_period_start, approve_payment) are the authoritative implementation;
 * this module mirrors them for previews and is covered by unit tests so the
 * two stay in agreement.
 */

export type DurationUnit = "days" | "months";
export type AccessState = "normal" | "suspended" | "cancelled";
export type MembershipStatus =
  "active" | "expired" | "suspended" | "cancelled" | "none" | "scheduled";
export type RenewalRule = "from_expiry" | "from_approval";

export interface Period {
  starts_at: string | Date;
  ends_at: string | Date;
}

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));

/** Offset (ms) between wall-clock time in `tz` and UTC at instant `d`. */
function tzOffset(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/**
 * Adds a plan duration. "days" is an exact number of 24h days; "months" is a
 * calendar-month step in the gym's timezone, clamped to the last day of the
 * month (31 Jan + 1 month = 28/29 Feb), matching PostgreSQL interval rules.
 */
export function addDuration(
  start: Date,
  unit: DurationUnit,
  value: number,
  tz = "Africa/Lagos",
): Date {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error("Duration must be a positive whole number");
  if (unit === "days") return new Date(start.getTime() + value * 86_400_000);
  const off = tzOffset(start, tz);
  const local = new Date(start.getTime() + off);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + value;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(local.getUTCDate(), lastDay);
  const wall = Date.UTC(
    targetY,
    targetM,
    day,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  const guess = new Date(wall - off);
  return new Date(wall - tzOffset(guess, tz));
}

/** Status derivation. Validity window is [starts_at, ends_at). */
export function deriveStatus(
  periods: Period[],
  access: AccessState,
  now = new Date(),
): MembershipStatus {
  if (access === "suspended") return "suspended";
  if (access === "cancelled") return "cancelled";
  if (periods.length === 0) return "none";
  const t = now.getTime();
  if (periods.some((p) => toDate(p.starts_at).getTime() <= t && toDate(p.ends_at).getTime() > t))
    return "active";
  const latest = latestEnd(periods)!;
  return latest.getTime() > t ? "scheduled" : "expired";
}

export function latestEnd(periods: Period[]): Date | null {
  if (!periods.length) return null;
  return new Date(Math.max(...periods.map((p) => toDate(p.ends_at).getTime())));
}

/** Where a new period starts: continuous renewals keep paid time; lapsed ones start now. */
export function nextPeriodStart(periods: Period[], rule: RenewalRule, now = new Date()): Date {
  const end = latestEnd(periods);
  if (rule === "from_expiry" && end && end.getTime() > now.getTime()) return end;
  return now;
}

export function canEnter(status: MembershipStatus | "not_found" | "error"): boolean {
  return status === "active";
}

export function daysRemaining(
  expiresAt: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!expiresAt) return null;
  const ms = toDate(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function describeDuration(unit: DurationUnit, value: number): string {
  if (unit === "days") return value === 7 ? "7 days" : `${value} day${value === 1 ? "" : "s"}`;
  return `${value} calendar month${value === 1 ? "" : "s"}`;
}
