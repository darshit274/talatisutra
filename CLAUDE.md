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
2. **Every protected page and route handler re-checks the session server-side**, via
   `requireUser()` / `requireAdmin()` in the page or route itself. There is no
   `proxy.ts` (Next 16's renamed `middleware.ts`) doing a cheap edge-redirect in front
   of these routes — it was removed entirely during Phase 6. Next.js 16.3.6 has a
   confirmed bug where a `proxy.ts`/middleware matching any route breaks Server Action
   body parsing in production (reproduced with a minimal test case; narrowing the
   matcher, including excluding Server Action requests via a `missing` header
   condition, does not help). Since Prisma can't run in edge middleware anyway, a
   proxy-level redirect was only ever a cheap UX nicety, never the authorisation
   boundary — so removing it changes nothing about the security model, only the
   Server Action reliability.
3. **Never trust a role, department or user id coming from the client.** Read them from
   the session row, always.
4. **Admin-only routes check `role === 'ADMIN'` in the route itself**, not just in the
   layout and not by hiding the link.
5. **Disk filenames are random UUIDs.** Never write a user-supplied filename to disk, and
   never interpolate one into a path.
6. **Validate uploads by magic bytes, not just the declared MIME type.** Allowed: PDF,
   PNG, JPEG, WebP, DOC, DOCX. Max 25 MB.
7. **Deactivating or deleting an employee deletes their sessions** so access is revoked
   immediately, not at token expiry.
8. **Self-registered accounts require email verification before login** —
   `User.emailVerified` gates session creation in both `/login` and
   `/verify-email`'s own action. They also have no department by construction
   (`departmentId: null`, never settable from the registration form) and so only
   ever see `visibility: "ALL"` materials — there is no path to self-assign a
   department.
9. **The authenticated app is internal; the public marketing site is indexable.** Root
   metadata defaults to `robots: { index: false, follow: false }`, which `(app)` (portal,
   admin) and `(auth)` inherit unchanged. `(marketing)`'s own pages (Home, About,
   Services, Articles, Contact, Privacy, Disclaimer) override this per-page to
   `{ index: true, follow: true }` — a scoped carve-out, not a blanket repeal.
   `robots.txt` allows those public paths and disallows everything else. Do not add a
   sitemap, structured data, or any other SEO work beyond this carve-out.
10. **Passwords**: bcrypt, cost 12. Never log them, never return a hash from an API.
11. **Secrets live in `.env`**, which is gitignored. Commit `.env.example` instead.

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

Payment gateway, e-commerce, bulk email, live chat, mobile app, analytics,
SEO tooling.

## Gujarati/English bilingual content

The header's English/ગુજરાતી toggle (`app/(marketing)/_components/marketing-header.tsx`)
is real, not decorative — client-requested 2026-10-30, after initially shipping as a
visual-only placeholder (the toggle used to log "this site does not yet translate";
see `docs/superpowers/specs/2026-10-17-talatisutra-classical-redesign-design.md` for
that original scoping). Scope is **admin-managed content only**: every translatable
field on SiteSettings, ContentBlock (all 5 block types), Article and ArticleCategory
has an optional `*Gu` counterpart (nullable column, or a sibling JSON key for
ContentBlock), entered side-by-side in the admin forms via
`components/admin/bilingual-input.tsx` / `bilingual-textarea.tsx`. Static UI chrome —
nav labels, button text, auth form labels — stays English-only; translating that
would mean a hardcoded string dictionary, which was explicitly left out of this round.

The current locale is a cookie (`lib/i18n-server.ts`'s `getLocale`/`setLocaleCookie`),
read server-side and passed down as a `locale` prop — never read from a client
component directly, since `next/headers` can't be imported there (that's why
`pickLocale`/`Locale` live in the dependency-free `lib/i18n.ts`, split from the
cookie-reading `lib/i18n-server.ts`). Every render site picks text with
`pickLocale(locale, enValue, guValue)`: Gujarati if the visitor chose it and a
translation was actually entered, English otherwise — never blank.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
