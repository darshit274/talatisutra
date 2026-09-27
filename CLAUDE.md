# CLAUDE.md

Internal employee portal for an office client. Five public information pages plus a
login-protected materials library (PDFs and images) and an admin dashboard.
Built by Viewebit. Full specification lives in `docs/BUILD-PLAN.md` — read it before
starting any phase.

## Stack

- Next.js 16.3.6 (App Router) + React 19.2.8 + TypeScript, scaffolded with
  `create-next-app@latest`
- Tailwind CSS v4 + shadcn/ui (`style: "base-nova"`, built on `@base-ui/react`, not
  Radix) + lucide-react
- MySQL via Prisma **6.19.3** — pinned deliberately. `prisma`'s npm `latest` tag
  currently resolves to a `8.0.0-rc` while `@prisma/client`'s `latest` is `7.10.0`
  (mismatched majors, and Prisma 7 drops `datasource { url }` from the schema in favor
  of `prisma.config.ts` + driver adapters). Do not bump past 6.x without deliberately
  adopting that new config model first.
- shadcn's `form` component has no implementation yet for the `base-nova` style (empty
  registry stub) — build forms with `react-hook-form` + `@hookform/resolvers` (both
  installed) directly against `input`/`label`/`select`/etc., not a `<Form>` wrapper.
- `bcryptjs` and `nodemailer` ship their own TypeScript types now; skip
  `@types/bcryptjs` / `@types/nodemailer` from BUILD-PLAN §2, they're unneeded.
- Custom database-backed sessions (no Auth.js — see BUILD-PLAN §4 for why)
- Nodemailer over SMTP on the client's own domain
- Deployed to a Hostinger KVM VPS behind Nginx, run under PM2

## Security rules — never break these

1. **Uploaded files never live under `public/`.** They go in `STORAGE_DIR`, outside the
   repo, and are served only through `GET /api/materials/[id]/file` after an auth and
   department check. A file must never be reachable by guessing a URL.
2. **Every protected page and route handler re-checks the session server-side.**
   `middleware.ts` only does a cheap cookie-presence redirect; it is not an
   authorisation boundary. Prisma cannot run in edge middleware.
3. **Never trust a role, department or user id coming from the client.** Read them from
   the session row, always.
4. **Admin-only routes check `role === 'ADMIN'` in the route itself**, not just in the
   layout and not by hiding the link.
5. **Disk filenames are random UUIDs.** Never write a user-supplied filename to disk, and
   never interpolate one into a path.
6. **Validate uploads by magic bytes, not just the declared MIME type.** Allowed: PDF,
   PNG, JPEG, WebP. Max 25 MB.
7. **Deactivating or deleting an employee deletes their sessions** so access is revoked
   immediately, not at token expiry.
8. **The site is internal.** Root metadata sets `robots: { index: false, follow: false }`
   and `robots.txt` disallows everything. Do not add sitemaps, structured data, or any
   other SEO work.
9. **Passwords**: bcrypt, cost 12. Never log them, never return a hash from an API.
10. **Secrets live in `.env`**, which is gitignored. Commit `.env.example` instead.

## Working conventions

- Mutations use Server Actions, except file upload, which uses a route handler
  (`export const runtime = 'nodejs'`) to avoid the Server Action body size limit.
- Validate every input with Zod at the server boundary. Client-side validation is a
  convenience, never the check.
- Keep database access in `lib/db/` or `lib/queries/`. Components do not call Prisma
  directly except in server components fetching their own data.
- One shadcn component per import; do not hand-roll a button, dialog or table that
  shadcn already provides.
- Before ending any phase: `npx tsc --noEmit`, `npm run lint`, and `npm run build` must
  all pass. Fix what you broke rather than suppressing it.
- Never run `prisma migrate reset` or any destructive command against a database you did
  not create in this session. Ask first.
- Do not add dependencies beyond those listed in BUILD-PLAN §2 without asking.

## Out of scope — do not build

Payment gateway, e-commerce, bulk email, live chat, mobile app, multi-language,
analytics, SEO tooling, employee self-signup.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
