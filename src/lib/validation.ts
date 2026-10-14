/** Shared, browser-safe validators for sign-up and profile forms. */

/**
 * Nigerian mobile numbers: 11 digits starting 07/08/09 (e.g. 08031234567),
 * or the same number in international form +234 8031234567.
 * Returns the normalised local 11-digit form, or null if invalid.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  let local: string;
  if (/^\+234\d{10}$/.test(digits)) local = "0" + digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) local = "0" + digits.slice(3);
  else local = digits;
  if (!/^0[789][01]\d{8}$/.test(local)) return null;
  // Reject obvious fakes like 08000000000 or 08011111111.
  if (/^(\d)\1+$/.test(local.slice(3))) return null;
  return local;
}

const DISPOSABLE = new Set([
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "throwawaymail.com",
  "example.com",
  "test.com",
]);

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

/** Format + throwaway-domain check. Mailbox domain existence is checked on the server. */
export function emailProblem(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!EMAIL.test(e) || e.includes("..")) return "Enter a valid email address";
  const domain = e.split("@")[1]!;
  if (DISPOSABLE.has(domain)) return "Use your real email address, not a temporary one";
  return null;
}
