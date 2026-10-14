# OGV Gym — Membership Management Platform

## 1. Analysis summary

**PRD core question:** "Is this person currently authorised to use the gym?" Everything serves verification and renewal approval.

**Roles:** Member, Administrator, Reception (verify only — cannot approve payments or change dates). Admin accounts are never created by public signup.

**Membership states:** No membership, Active, Expired, Suspended, Cancelled, plus a "Pending renewal" flag that never changes access by itself.

**Reference analysis**
- Ref 1 (cyan dashboard): strong left nav, dense but scannable tables, list of upcoming items with status dots. Weakness: loud colour everywhere, decorative charts.
- Ref 2 (FitZone member view): the stronger direction. Dark sidebar, calm off-white canvas, single dark hero card for membership with status pill + dates + progress bar, QR "Quick Access" panel, history list with Active/Expired pills, quiet bordered panels, black primary buttons.
- Decision: adopt Ref 2 as the system for both portals; borrow Ref 1's table and list density for admin queues. No gradients, no vanity charts.

## 2. Design system

- **Palette:** ink sidebar (near-black green-tinted), warm off-white canvas, white panels with hairline borders, one brand accent (deep gym green, from Ref 2). Status colours reserved for meaning: green = granted/active, red = denied/expired, amber = pending/expiring, slate = no membership, dark red/striped = suspended.
- **Type:** Bricolage Grotesque for headings (character), Geist for body, Geist Mono for member IDs, dates, amounts.
- **Shapes:** 10px radius panels, 8px inputs/buttons, borders over shadows.
- **Components:** StatusBadge (icon + text, one definition used everywhere), AccessDecision banner (huge, icon + word + reason), MembershipCard, DataTable with mobile card fallback, ConfirmDialog, EmptyState, skeletons, toasts only after confirmed server success.
- **Motion:** 150–200ms fades/slides on dialogs and route changes; disabled under reduced-motion.

## 3. Screens

**Public:** Sign in, Register, Forgot password, Reset password. Simple landing at `/` with sign-in/register (no marketing bloat).

**Member portal** (`/app`): Dashboard (status card, days left, QR pass, pending/rejected notices), Renew (plans, payment instructions, evidence upload, "upload ≠ activation" notice), Payments & history, Notifications, Profile.

**Admin** (`/admin`): Overview (operational counts + pending queue + expiring soon), **Verify** (always one click away, also a persistent shortcut; search by ID/name/email/phone; QR camera scan), Members (search, filters, pagination, profile with activate/extend/suspend/reactivate/cancel + date preview), Plans, Payment verification (queue, receipt viewer, approve/reject with reason/request clarification), Expiry (expiring soon / recently expired), Reports (counts, revenue from approved payments, verification stats), Activity logs, Settings (timezone, renewal rule, payment instructions, staff roles).

Mobile: verify screen is search-first with full-width decision; tables collapse to cards; member status visible at the top.

## 4. Business rules (centralised server-side)

- Status computed by one database function from the membership record + current time + suspension/cancellation — never trusted from client or cached field.
- Activation/extension/approval only through server functions that check admin role; RLS blocks members from writing memberships or payment status.
- Approval runs in a single database transaction with row lock and status check (`pending` → `approved`), so a second click cannot extend twice.
- Renewal start: if active, from current expiry; if expired/none, from approval time (configurable in Settings).
- Durations: `days` or `calendar_months`, computed in the gym timezone (default Africa/Lagos).
- Verification failures (network/server) show UNABLE TO VERIFY, never granted.
- QR encodes only a member ID/token; scanning triggers a fresh server lookup.
- Receipts in a private storage bucket; viewed by admins via short-lived signed URLs.
- Every membership change, payment decision, role change, and verification is written to an audit log.

## 5. Notifications

In-app notifications written in the same transaction as the change (activated, approved, rejected, suspended, renewal submitted → admins). Expiring-soon/expired notices generated when the dashboard loads plus a scheduled endpoint. Email hooks prepared but not sent until an email domain is set up (documented as pending).

## Technical details

- **Stack note:** Next.js isn't available in this environment. The equivalent here is TanStack Start (React + TypeScript, server functions, SSR) with Tailwind v4 and Lovable Cloud (Postgres, auth, private storage). Same architecture: server-only logic, typed RPC, RLS-protected Postgres.
- **Tables:** `profiles` (member_code OGV-00001 generated, name, phone, photo), `user_roles` (admin, reception, member — separate table + `has_role`), `membership_plans` (name, price_kobo, duration_type, duration_value, description, terms, is_active), `memberships` (member, plan, starts_at, expires_at, state: active/suspended/cancelled, created_by), `membership_events` (prev/new expiry, reason, actor), `payment_requests` (plan, amount, reference, paid_on, receipt_path, note, status pending/approved/rejected/clarification, reviewer, reason), `verification_logs`, `audit_logs`, `notifications`, `gym_settings`.
- **Postgres functions (security definer, role-checked):** `membership_status(user)`, `verify_member(query)`, `approve_payment(id, plan, start_rule)`, `reject_payment`, `admin_extend`, `admin_set_suspension`, all transactional.
- **Modules:** `src/lib/auth`, `members`, `plans`, `membership` (pure date/status logic shared with tests), `payments`, `verification`, `notifications`, `audit`.
- **Routes:** public auth routes, `_authenticated/app/*`, `_authenticated/admin/*` (role gate).
- **Admin bootstrap:** first admin assigned via a one-time database step I'll run for your account after you register; further staff are promoted by an admin in Settings.
- **Seed data:** only plans (Weekly ₦5,000 / 7 days, Monthly ₦15,000 / 1 calendar month, Quarterly ₦40,000 / 3 months) as editable placeholders. No fake members.
- **Tests (vitest):** expiry calculation (days vs calendar months, timezone boundaries), status derivation for all states, renewal start rule, duplicate approval, permission denial for members, verification error state.
- **Docs:** README section covering setup, environment, migrations, admin bootstrap, tests, deployment, pending email setup.

## Build order

1. Enable Cloud, schema + RLS + functions, design system tokens.
2. Auth pages + member dashboard + renewal submission.
3. Admin verify, payment verification, members, plans.
4. Expiry, reports, logs, settings, notifications.
5. Tests, responsive checks at 390/768/1280, docs.
