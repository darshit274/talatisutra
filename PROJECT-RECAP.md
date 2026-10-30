# Employee Portal — Project Recap

_Generated 30 Sep 2026. A snapshot of what's been built so far — see `docs/BUILD-PLAN.md`
for the full spec and `CLAUDE.md` for working rules._

## What this is

An internal employee portal for an office client (built by Viewebit): five public
marketing pages, a login-protected materials library, and a full admin dashboard.
Next.js 16.3.6 (App Router) + React 19.2.8 + TypeScript, MySQL via Prisma, Tailwind v4 +
shadcn/ui (`base-nova`/`@base-ui/react`), custom database-backed sessions (no Auth.js).

## Phases completed

| Phase | Status | What's in it |
|---|---|---|
| 0 | ✅ Committed | Scaffold, Tailwind, shadcn init, Prisma connected, `.env.example`, seed script |
| 1 | ✅ Done | Full schema (10 models), 3 migrations applied |
| 2 | ✅ Committed | Auth end to end: login, logout, 6-attempt throttling/lockout, forgot/reset password, forced change-password, `requireUser`/`requireAdmin` |
| 3 | ✅ Committed | 5 public pages (home, about, services, information, contact) + contact form + enquiry email |
| 4 | ✅ Committed | Employee portal: materials list, category/type filters, search, detail view, file streaming with range support |
| 5 | ✅ Committed | Admin: materials CRUD + upload (magic-byte validated), categories, departments, employees CRUD, enquiries inbox |
| 6 | ⚠️ Built, **not yet committed** | Audit log wired into every mutation, production security headers, README rewritten, full validation pass. Also fixed two real production bugs found during this phase (see below) |
| 7 | ❌ Not started | Deployment: PM2 `ecosystem.config.js`, Nginx config, certbot, `mysqldump` backup cron, `docs/DEPLOY.md` |

**22 files are currently modified/new and uncommitted** — everything from Phase 6 onward
(`git status` confirms). Nothing has been lost, it just hasn't been committed to git yet.

## Feature map (everything that exists right now)

**Public** (`app/(marketing)/`): home, about, services, information, contact (with
honeypot spam protection + throttled enquiry email).

**Auth** (`app/(auth)/`): login (6-attempt lockout), forgot-password, reset-password
(single-use token, kills existing sessions), change-password (forced on first login).

**Employee portal** (`app/(app)/portal/`): home/dashboard, materials list with
category/type/search filters, material detail, PDF/image streaming scoped by department
visibility.

**Admin** (`app/(app)/admin/`): dashboard (stat cards + **3 charts**: employees by
department, materials by category, activity over the last 7 days — added this session),
materials (CRUD + upload + replace-file), categories, departments, employees (CRUD +
set-password + deactivate/reactivate/delete), enquiries inbox.

**Profile** (`app/(app)/profile/`) — new this session: every logged-in user (employee or
admin) can view and edit their own name/designation/phone from a page reachable via the
sidebar or by clicking their own name in the header. Email/role/department stay
admin-managed by design.

**API routes**: authenticated file streaming (`/api/materials/[id]/file`), upload
(`/api/materials/upload`), replace-file — all outside Server Actions to avoid the body
size limit, all with their own auth/department checks.

**Data model** (`prisma/schema.prisma`): Department, User, Session,
PasswordResetToken, LoginAttempt, Category, Material, MaterialDepartment,
ContactEnquiry, AuditLog — 10 models, 3 migrations.

## Real bugs found and fixed this session

1. **Next.js 16.3.6 confirmed bug**: any `proxy.ts`/middleware matching a route breaks
   Server Action body parsing in production. Reproduced with a minimal test case;
   narrowing the matcher didn't help. Fixed by removing `proxy.ts` entirely — auth was
   already enforced per-route via `requireUser()`/`requireAdmin()`, so nothing about the
   security model changed, only Server Action reliability.
2. **CSP misconfiguration**: `Content-Security-Policy` had no `script-src` directive, so
   it inherited `default-src 'self'` — which silently blocks the inline
   `<script>self.__next_f.push(...)</script>` tags Next uses to stream hydration data.
   Result: React never hydrated *any* page in production (dialogs, dropdowns — anything
   not a plain `<form>` — were completely dead), while native form submissions kept
   working via progressive enhancement, which masked the failure. Fixed by adding
   `script-src 'self' 'unsafe-inline'`.
3. **Timezone bug** in the new "activity — last 7 days" chart: day-bucketing mixed
   local-time `Date` methods with UTC `toISOString()` truncation, shifting every bucket
   back a day and dropping "today" entirely. Fixed to bucket consistently by local
   calendar day via `date-fns`.
4. Two smaller upload-form bugs from earlier in Phase 6 testing: a body-size cap on
   uploads (fixed by excluding `/api/*` from the now-removed proxy matcher) and a
   missing native-fallback default on the material visibility field.

## Dependencies

Everything in `docs/BUILD-PLAN.md` §2, plus **`recharts`** — added this session for the
admin dashboard charts, with explicit approval first (per the project's own rule not to
add dependencies without asking).

## What's genuinely left

- **Commit Phase 6 + the profile/chart work.** Nothing has been committed since Phase 5.
- **Phase 7 (deployment)** — not started at all.
- One BUILD-PLAN §13 manual test item (360px layout) is only verified at the CSS/JS
  logic level, not visually, due to a browser-automation tooling limitation.
- `mustChangePassword` on the seed admin was left `false` after a mid-session
  re-verification login — harmless for local dev, flagged in case you want it reset.
