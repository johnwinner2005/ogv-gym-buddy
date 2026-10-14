import { describe, expect, it } from "vitest";
import { addDuration, canEnter, daysRemaining, deriveStatus, nextPeriodStart } from "./membership";

const d = (s: string) => new Date(s);

describe("addDuration", () => {
  it("weekly plan adds exactly 7 days", () => {
    expect(addDuration(d("2026-10-14T09:00:00Z"), "days", 7).toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });
  it("30 days is not the same as one calendar month", () => {
    const start = d("2026-01-15T10:00:00Z");
    expect(addDuration(start, "days", 30).toISOString()).toBe("2026-02-14T10:00:00.000Z");
    expect(addDuration(start, "months", 1).toISOString()).toBe("2026-02-15T10:00:00.000Z");
  });
  it("calendar month clamps to end of month", () => {
    // 31 Jan 12:00 Lagos (11:00Z) + 1 month = 28 Feb 2026
    expect(addDuration(d("2026-01-31T11:00:00Z"), "months", 1).toISOString()).toBe("2026-02-28T11:00:00.000Z");
  });
  it("months are counted in the gym timezone, not UTC", () => {
    // 23:30Z on 31 Mar is 00:30 on 1 Apr in Lagos; +1 month = 1 May 00:30 Lagos
    expect(addDuration(d("2026-03-31T23:30:00Z"), "months", 1, "Africa/Lagos").toISOString()).toBe(
      "2026-04-30T23:30:00.000Z",
    );
  });
  it("quarterly adds three calendar months", () => {
    expect(addDuration(d("2026-11-30T09:00:00Z"), "months", 3).toISOString()).toBe("2027-02-28T09:00:00.000Z");
  });
  it("rejects zero or negative durations", () => {
    expect(() => addDuration(new Date(), "days", 0)).toThrow();
  });
});

describe("deriveStatus", () => {
  const now = d("2026-10-14T12:00:00Z");
  const active = { starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-31T00:00:00Z" };
  const old = { starts_at: "2026-08-01T00:00:00Z", ends_at: "2026-09-01T00:00:00Z" };

  it("new account without membership has no membership and no access", () => {
    expect(deriveStatus([], "normal", now)).toBe("none");
    expect(canEnter("none")).toBe(false);
  });
  it("active period grants access", () => {
    expect(deriveStatus([old, active], "normal", now)).toBe("active");
    expect(canEnter("active")).toBe(true);
  });
  it("expired period is denied", () => {
    expect(deriveStatus([old], "normal", now)).toBe("expired");
    expect(canEnter("expired")).toBe(false);
  });
  it("suspended is denied even with a future expiry", () => {
    expect(deriveStatus([active], "suspended", now)).toBe("suspended");
    expect(canEnter("suspended")).toBe(false);
  });
  it("expiry instant itself is no longer valid", () => {
    expect(deriveStatus([active], "normal", d("2026-10-31T00:00:00Z"))).toBe("expired");
  });
  it("unable to verify never grants access", () => {
    expect(canEnter("error")).toBe(false);
    expect(canEnter("not_found")).toBe(false);
  });
});

describe("nextPeriodStart", () => {
  const now = d("2026-10-14T12:00:00Z");
  it("continuous renewal starts at current expiry", () => {
    const p = [{ starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-20T00:00:00Z" }];
    expect(nextPeriodStart(p, "from_expiry", now).toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
  it("expired membership restarts at approval time", () => {
    const p = [{ starts_at: "2026-08-01T00:00:00Z", ends_at: "2026-09-01T00:00:00Z" }];
    expect(nextPeriodStart(p, "from_expiry", now)).toEqual(now);
  });
  it("from_approval rule ignores remaining time", () => {
    const p = [{ starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-20T00:00:00Z" }];
    expect(nextPeriodStart(p, "from_approval", now)).toEqual(now);
  });
});

describe("daysRemaining", () => {
  it("rounds partial days up and floors at zero", () => {
    const now = d("2026-10-14T12:00:00Z");
    expect(daysRemaining("2026-10-15T00:00:00Z", now)).toBe(1);
    expect(daysRemaining("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(daysRemaining(null, now)).toBeNull();
  });
});
