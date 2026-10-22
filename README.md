# Origin Website

Official website for **Origin**, a developer workspace built to help developers organize their coding projects, understand what each project is, and launch projects in their preferred editor.

Origin is built as a native desktop application using Tauri, with a React-based interface.

This repository contains the public marketing and download website for Origin.

---

## About Origin

Origin is designed around a simple idea:

> Your code. One place.

Instead of searching through folders and remembering where different projects are located, Origin provides a centralized workspace for discovering, organizing, and launching development projects.

Origin can detect different types of development projects and provides project-level information such as metadata, favorites, Git information, and recent activity.

---

## Features

The Origin desktop application currently focuses on:

- Project organization
- Project detection
- Project browsing
- Project metadata
- Favorites
- Git information
- Branch information
- Project launching
- Preferred editor integration
- System tray integration
- Global overlay
- System information
- Automatic application updates
- Windows support
- macOS support

Linux support is planned for a future release.

---

## Website

The website provides:

- Product overview
- Feature explanations
- Platform availability
- Download access
- Release changelog
- Frequently asked questions
- Links to the Origin GitHub repository

---

## Tech Stack

The website is built with:

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide Icons

The exact dependencies can be found in `package.json`.

## Feedback & Admin

The public feedback form is available at `/feedback`. It posts to `/api/feedback`, which validates and persists submissions in Supabase using the server-only secret key. It applies field limits, a honeypot, a 32 KB request limit, and an in-memory limit of five submissions per hashed IP per hour. Raw IP addresses are never stored.

The protected admin workspace is available at `/admin`. It uses a cryptographically random `__Host-` `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Only a SHA-256 hash of the token is stored in the server-side `admin_sessions` table, and admin APIs check expiration/revocation and the trusted `ADMIN_EMAIL` value on every request. The dashboard APIs independently authorize requests; the frontend route is not a security boundary.

### Production setup

1. Create a Supabase project and run [`supabase/feedback.sql`](supabase/feedback.sql), then [`supabase/origin_features.sql`](supabase/origin_features.sql) in its SQL editor. The feature migration creates the `origin` application record and uses Supabase's built-in `auth.users` table. It does not delete feedback rows. Review the SQL and use a development project first; it has not been applied to a live database from this repository.
2. Add these Vercel environment variables. Never prefix any of them with `VITE_`:
	- `SUPABASE_URL`: Supabase project URL.
	- `SUPABASE_ANON_KEY`: Supabase anon/publishable key, used only in server functions for Auth and user-scoped REST requests. It is not a service-role key.
	- `SUPABASE_SECRET_KEY`: server-only Supabase service-role/secret key.
	- `ADMIN_EMAIL`: the single administrator email address.
	- `ADMIN_PASSWORD_HASH`: a generated scrypt hash, never the plaintext password.
	- `RATE_LIMIT_SALT`: at least 32 random bytes for IP hashing (optional fallback is the Supabase secret).
3. Generate the first administrator hash locally, without putting the password in source control:

```powershell
node -e "const c=require('node:crypto'); const p=process.stdin.isTTY ? (()=>{throw Error('Pipe the password on stdin')})() : require('node:fs').readFileSync(0,'utf8').trim(); const s=c.randomBytes(16).toString('base64url'); console.log('scrypt$'+s+'$'+c.scryptSync(p,s,64).toString('base64url'))" < $env:ADMIN_PASSWORD_FILE
```

Set the resulting value as `ADMIN_PASSWORD_HASH` and set `RATE_LIMIT_SALT` to an independently generated random value. Store these only in the Vercel project environment and local untracked `.env.local`. `ADMIN_SESSION_SECRET` is no longer used.
4. Use `vercel dev` for local end-to-end API testing. `npm run dev` is suitable for frontend-only work; Vite does not execute the `api/` functions.

Login attempts are rate-limited per server instance. For multi-instance deployments, put an edge/WAF rate limit in front of `/api/admin/login` as an additional control. Admin sessions can be individually or globally revoked from Management.

## Download tracking foundation

The project still uses Vercel serverless functions and Supabase; it does not run Express or Prisma. The account page at `/account` uses Supabase Auth for registration, login, email verification, recovery, logout, profile/email/password settings, and deletion. Its access and refresh tokens are stored in Secure, HttpOnly cookies. The download history contains only authenticated full-transfer events. Existing anonymous visitor identities stay anonymous. The community section exposes published reviews and comments, lets signed-in users create/edit/delete their own entries and submit abuse reports; bug reports continue through `/feedback`.

Register release metadata via protected `POST /api/admin/installers` before the download buttons can use tracking. It accepts a `version`, canonical GitHub `releaseUrl`, optional ISO `releasedAt`, boolean `prerelease`, and `assets` array containing `name`, official `url`, supported `platform`, and optional `size`. The API validates Origin's exact GitHub release path, platform filename extension, and asset URL before saving. `GET /api/installers` returns active stable installer assets; the download section matches them to GitHub release filenames and uses the proxy when matched. Until then, existing direct GitHub links remain available. `GET /api/downloads?asset=<installer UUID>` returns a public unique count. `GET /api/download?asset=<installer UUID>` proxies an active registered GitHub installer and forwards range/conditional headers. It logs request and transfer outcomes; partial ranges are logged as completed transfers but do not count as a full installer download. A full count means the server finished streaming the full response; it does not prove the file was saved or installed on the visitor's device. `GET /api/admin/downloads` returns the latest 500 events and event-type/day summaries, protected by the existing admin session.

The Admin Management view now connects download analytics, installer registration/activation, review/comment/report moderation, user search/suspension, admin session revocation, and an audit log to protected APIs. Suspending an account updates its profile and deletes its Supabase Auth sessions transactionally; existing access tokens are still JWTs and remain cryptographically valid until expiry, but application APIs and RLS reject suspended profiles. The existing administrator cookie format is replaced, so existing admins must sign in again after deployment. Apply the migration before deploying the changed admin login.

In Supabase Auth settings, set the site URL and allow-list the deployed `/account` URL. Configure the signup confirmation template link as `{{ .SiteURL }}/account?token_hash={{ .TokenHash }}&type=signup`, the recovery template as `{{ .SiteURL }}/account?token_hash={{ .TokenHash }}&type=recovery`, and the email-change confirmation template as `{{ .SiteURL }}/account?token_hash={{ .TokenHash }}&type=email_change`. The actual public HTTP transfer path and the RLS/migration behavior still need a development Supabase and deployed Vercel test.

### Local test commands

Run `npm run build` for frontend and API TypeScript checks plus the production frontend build, and `npm test` for the local Node tests. The Supabase integration test is opt-in and skipped unless the development runner below is used.

### Development Supabase integration test

The opt-in test in `tests/supabase-development.integration.test.js` checks real Auth users, cross-user review updates, public moderation visibility, interrupted download counting, and concurrent deduplication. It creates disposable test users, one release, and one installer, then deletes only records created by that test. It does not run migrations. Never provide production credentials.

1. Create a separate Supabase project named `origin-development`. Confirm its project name and reference in the Supabase dashboard before continuing. Do not use the production project.
2. In that development project's SQL editor, apply `supabase/feedback.sql` and then `supabase/origin_features.sql`. Confirm both complete without errors. These migrations have not been executed from this repository.
3. From the repository root, run `powershell -ExecutionPolicy Bypass -File tests/run-supabase-development-tests.ps1`. Enter the development project reference and URL, then type `origin-development` only after confirming that exact project name in the Supabase dashboard. The runner then asks for the anon/publishable and service-role keys at hidden prompts. It verifies the URL/reference match, enables the integration test only for this run, clears the process environment variables afterward, and does not print the key values.
4. Review the test summary. A skipped integration test means the real database checks did not run. If a test fails, use only this development project to investigate; do not rerun the migration against production.

The local suite includes source-contract checks for RLS and the atomic deduplication SQL. Those checks do not prove PostgreSQL accepts the migration or that concurrent transactions behave correctly; the opt-in integration test is required for those claims. Vercel runtime streaming and interruption behavior still needs a deployment-preview check.

---

## Requirements

Before running the website locally, make sure you have:

- Node.js
- npm
- Git

---

## Installation

Clone the repository:

```bash
git clone https://github.com/ArihantJain2008/origin-website.git
