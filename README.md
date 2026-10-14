# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## OGV Gym membership platform

- **Stack:** TanStack Start (React, TypeScript, Tailwind v4) + Lovable Cloud (Postgres, auth, private storage). Environment variables are provisioned automatically; no secrets live in code.
- **Database:** migrations under `drizzle/migrations` (applied automatically). Seed data is limited to three editable placeholder plans.
- **First admin:** the first account registered becomes the administrator. Promote further staff (admin or reception) in Admin → Settings.
- **Tests:** `bunx vitest run` (date/status rules) and `supabase/tests/membership_rules.sql` (permissions, duplicate approval, renewal/expiry; run it in the database — it always rolls back and ends with `ALL_TESTS_PASSED`).
- **Deploy:** use Publish in Lovable. Email: password reset and sign-up confirmation use the built-in auth emails; app notification emails (expiry reminders) are in-app only until a sender domain is set up.

## Wallet passes
Secrets (Project → Secrets): Apple — `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`, optional `APPLE_PASS_KEY_PASSPHRASE`, `APPLE_WWDR_CERT_PEM` (G4). Google — `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`. Until set, the buttons show "not set up yet". Renew the Apple pass certificate yearly and replace the two PEM secrets. Push updates are not implemented; pass fields are identity-only, so they don't go stale.
