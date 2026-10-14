<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Membership status, access decisions, date maths and all privileged writes live in SECURITY DEFINER Postgres functions (compute_status, verify_member, approve_payment, admin_grant_period, …) — one authoritative, transactional, role-checked implementation.
- The browser calls those functions via the Supabase client RPC; it never writes membership periods, payment status or profile access fields (no grants/policies allow it).
- `src/lib/membership.ts` mirrors the SQL rules for previews only and is unit-tested; change both together.
- Approval idempotency relies on `FOR UPDATE` + status check + unique `membership_periods.payment_request_id`.
- Roles live in `user_roles`; signup only grants `member`. Only `super_admin` can grant/revoke `admin` (enforced in `admin_set_role`); staff accounts are created via the super-admin-only server fn in `src/lib/accounts.functions.ts`.
- Gym entry is recorded only via `admit_member` (re-checks live status) into `check_ins`.
- Receipts are in the private `receipts` bucket under `<member_id>/…`; admins read via short-lived signed URLs.
- Server-side rule tests: `supabase/tests/membership_rules.sql` (rolls back); unit tests: `bunx vitest run`.
- Access pass: permanent UID is `profiles.member_code`; the QR carries only an opaque `member_credentials.token` (one active per member, revocable via `rotate_credential`). Reception resolves it only through `verify_pass`, which re-checks live status — pass lifetime never affects access.
- Wallet issuance is server-only (`src/lib/wallet.server.ts`): Apple .pkpass signed with node-forge and served from `/api/public/wallet/apple` behind a 5-minute HMAC link; Google uses a signed save JWT (Generic pass). Pass tests: `supabase/tests/access_pass.sql`.
