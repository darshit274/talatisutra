# Employee Portal

Internal employee portal built for an office client by Viewebit. Five public
information pages plus a login-protected materials library (PDFs and images) and an
admin dashboard.

The full functional/security specification lives in [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md).
Project-specific rules and conventions (things that aren't obvious from the code) live
in [`CLAUDE.md`](CLAUDE.md). Read both before making structural changes.

## Stack

- Next.js 16.3.6 (App Router) + React 19.2.8 + TypeScript
- Tailwind CSS v4 + shadcn/ui (`base-nova` style, built on `@base-ui/react`)
- MySQL via Prisma **6.19.3** (pinned — see `CLAUDE.md` before bumping)
- Custom database-backed sessions (no Auth.js)
- Nodemailer over SMTP for contact/reset/new-account email

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values (a local MySQL instance,
   a generated `SESSION_SECRET`, and a `STORAGE_DIR` path *outside* the repo for
   uploaded files — see the comments in `.env.example`).
3. Run migrations and seed the database:
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Sign in with the
   `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in `.env`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (Fast Refresh, no security headers) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (`npm run build` first) |
| `npm run lint` | ESLint |
| `npm run db:seed` | Re-run `prisma/seed.ts` |

Before committing, run `npx tsc --noEmit`, `npm run lint`, and `npm run build` —
CI-equivalent local validation.

## Notable architecture decisions

- **No `proxy.ts` / middleware.** Every protected page and route handler re-checks the
  session server-side via `requireUser()` / `requireAdmin()`. A proxy-level redirect was
  only ever a cheap UX nicety (Prisma can't run in edge middleware anyway), and Next.js
  16.3.6 has a confirmed bug where any proxy/middleware matching a route breaks Server
  Action body parsing in production — see `CLAUDE.md` rule 2.
- **CSP allows `'unsafe-inline'` for scripts.** Required for Next's own RSC/hydration
  data (`self.__next_f.push(...)`) to run — without it, React silently fails to hydrate
  any page in production. See `docs/BUILD-PLAN.md` §9 for the full explanation.
- **Uploaded files are never under `public/`.** They live in `STORAGE_DIR`, outside the
  repo, and are served only through an authenticated route handler.

## Deployment

Deployment (Hostinger KVM VPS, Nginx, PM2, certbot, backups) is covered by
`docs/BUILD-PLAN.md` §14. A dedicated `docs/DEPLOY.md` is a Phase 7 deliverable and not
yet written.
