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

## Feedback & Support

The public feedback form is available at `/feedback`. On Vercel, the form posts to `/api/feedback`, which validates the request and inserts it into Supabase using the server-only secret key. The API uses a honeypot, a 32 KB request limit, field limits, and a privacy-conscious in-memory rate limit of five submissions per hashed IP per hour. Set `RATE_LIMIT_SALT` to a long random value; raw IP addresses are never stored.

### Production setup

1. Create a Supabase project and run [`supabase/feedback.sql`](supabase/feedback.sql) in its SQL editor.
2. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to Vercel environment variables. `RATE_LIMIT_SALT` is optional; when omitted, the server-only secret key is used as the hash salt. Never expose the secret key as a `VITE_` variable.
3. Deploy the project. `vercel.json` keeps direct `/feedback` navigation working while Vercel serves `/api/feedback` as a function.

For local UI development, copy `.env.example` to `.env.local`, fill the values, and run `npm run dev`. The API is hosted by Vercel, so use `vercel dev` locally when testing submissions against the function.

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