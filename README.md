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

The protected admin workspace is available at `/admin`. It uses server-side authentication with an `HttpOnly`, `Secure`, `SameSite=Lax` signed session cookie. The dashboard APIs independently verify that session before reading, updating, or deleting feedback; the frontend route is not a security boundary.

### Production setup

1. Create a Supabase project and run [`supabase/feedback.sql`](supabase/feedback.sql) in its SQL editor. For an existing installation, run the full file to migrate legacy statuses.
2. Add these Vercel environment variables. Never prefix any of them with `VITE_`:
	- `SUPABASE_URL`: Supabase project URL.
	- `SUPABASE_SECRET_KEY`: server-only Supabase service-role/secret key.
	- `ADMIN_EMAIL`: the single administrator email address.
	- `ADMIN_PASSWORD_HASH`: a generated scrypt hash, never the plaintext password.
	- `ADMIN_SESSION_SECRET`: at least 32 random bytes, used to sign sessions.
	- `RATE_LIMIT_SALT`: at least 32 random bytes for IP hashing (optional fallback is the Supabase secret).
3. Generate the first administrator hash locally, without putting the password in source control:

```powershell
node -e "const c=require('node:crypto'); const p=process.stdin.isTTY ? (()=>{throw Error('Pipe the password on stdin')})() : require('node:fs').readFileSync(0,'utf8').trim(); const s=c.randomBytes(16).toString('base64url'); console.log('scrypt$'+s+'$'+c.scryptSync(p,s,64).toString('base64url'))" < $env:ADMIN_PASSWORD_FILE
```

Set the resulting value as `ADMIN_PASSWORD_HASH` and set `ADMIN_SESSION_SECRET` and `RATE_LIMIT_SALT` to independently generated random values. Store these only in the Vercel project environment and local untracked `.env.local`.
4. Use `vercel dev` for local end-to-end API testing. `npm run dev` is suitable for frontend-only work; Vite does not execute the `api/` functions.

Login attempts are rate-limited per server instance. For multi-instance deployments, put an edge/WAF rate limit in front of `/api/admin/login` as an additional control. Rotate `ADMIN_SESSION_SECRET` to invalidate all active sessions.

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