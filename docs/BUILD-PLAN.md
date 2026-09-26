# Build plan — Employee portal website

Commit this at `docs/BUILD-PLAN.md`. `CLAUDE.md` at the repo root points here.

---

## 1. What is being built

A company website with two faces:

**Public** — five information pages anyone can view, plus a contact enquiry form.

**Private** — employees sign in and see a library of PDFs and images. What each employee
sees depends on the department they belong to. Nothing in the library is visible, listed
or downloadable while logged out.

**Admin** — a separate dashboard where the administrator uploads and organises materials,
decides which departments each item is visible to, and manages employee records
(create, edit, deactivate, delete, reset password).

There is no public sign-up. Accounts exist only because an admin created them.

---

## 2. Dependencies

Install exactly these. Ask before adding anything else.

```
next react react-dom typescript
prisma @prisma/client
tailwindcss
shadcn (CLI) + the components you actually use
lucide-react
zod
bcryptjs @types/bcryptjs
nodemailer @types/nodemailer
date-fns
```

shadcn components expected: `button`, `input`, `label`, `textarea`, `select`, `table`,
`dialog`, `alert-dialog`, `dropdown-menu`, `badge`, `card`, `tabs`, `sonner`, `form`,
`checkbox`, `separator`, `skeleton`.

---

## 3. Environment

`.env.example` (commit this; never commit `.env`):

```
DATABASE_URL="mysql://user:password@localhost:3306/employee_portal"

# 32+ random bytes, base64. Generate: openssl rand -base64 48
SESSION_SECRET=""

# Absolute path OUTSIDE the repo. Created and chowned to the app user on the VPS.
STORAGE_DIR="/var/www/portal-storage"

SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="no-reply@clientdomain.com"
SMTP_PASS=""
MAIL_FROM="Company Name <no-reply@clientdomain.com>"
CONTACT_NOTIFY_EMAIL="office@clientdomain.com"

APP_URL="https://clientdomain.com"

# Behind Nginx, the app must read the client IP from X-Forwarded-For instead of the
# socket address (always 127.0.0.1 behind a reverse proxy). Number of proxy hops to
# trust — 1 for a single Nginx in front of Node. See §4 and §14.
TRUST_PROXY_HOPS="1"

# Seed script only. Optional in production — lib/env.ts enforces these only when
# NODE_ENV !== 'production'; `prisma/seed.ts` fails loudly on its own if they're unset.
SEED_ADMIN_EMAIL=""
SEED_ADMIN_PASSWORD=""
```

Validate all of these at boot in `lib/env.ts` with Zod and fail loudly if any is missing,
except `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, which the app's boot-time schema treats
as optional (production has no seed step) and the seed script validates itself.
A silent undefined here becomes a security hole later.

---

## 4. Authentication design

**Why not Auth.js.** The admin can deactivate or delete an employee, and that must cut
access immediately. JWT sessions stay valid until they expire, so a deactivated employee
would keep reading documents. Database-backed sessions revoke on the next request. The
implementation is about 150 lines and has no version churn.

### Session mechanics

- On successful login, generate 32 random bytes → base64url. That is the raw token.
- Store `sha256(token)` in `Session.tokenHash`. The raw token exists only in the cookie.
- Cookie `vw_session`: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`,
  7-day expiry.
- `lib/auth/session.ts` exports:
  - `createSession(userId, ip, userAgent)` → sets the cookie
  - `getCurrentUser()` → cached per request; returns `null` if no cookie, no matching
    session row, session expired, or `user.isActive === false`
  - `requireUser()` → redirects to `/login?next=…` when null
  - `requireAdmin()` → additionally redirects non-admins to `/portal`
  - `destroySession()` and `destroyAllSessionsForUser(userId)`
- Sliding renewal: if a session has under 24 hours left, extend it by 7 days on use.
- A cron or lazy sweep deletes expired session rows.

### Login throttling

Record every attempt in `LoginAttempt`. Reject when there have been 5 or more failures
for the same email **or** the same IP in the last 15 minutes, and return the same generic
error either way. Never reveal whether an email exists.

**Getting the real IP.** The app runs behind Nginx, so `req.socket.remoteAddress` is
always `127.0.0.1` unless Nginx forwards the client's address and the app trusts it.
Nginx must set `X-Forwarded-For` (§14); `lib/auth/ip.ts` reads the entry `TRUST_PROXY_HOPS`
positions from the *right* of that header (never the left-most value — it's
attacker-supplied) and falls back to the socket address only when the header is absent.
Skipping this collapses every request behind the proxy onto one IP, so the first attacker
to trip the per-IP limit locks out every other user sharing it.

**Same limiter on other unauthenticated mail-sending endpoints.** `/forgot-password` and
the `/contact` Server Action can each be used to flood mail without logging in. Apply the
same per-IP window (5 submissions / 15 minutes, identical generic response either way),
reusing the `LoginAttempt` table/pattern rather than building a second mechanism. Give the
contact form one honeypot field too (hidden, must arrive empty) — silently drop
submissions that fill it instead of erroring, so a bot doesn't learn it was caught.

### Password reset

1. `/forgot-password` takes an email. Always respond with the same message whether or not
   the account exists.
2. If it exists and is active: generate a 32-byte token, store `sha256(token)` in
   `PasswordResetToken` with a 1-hour expiry, email the link
   `${APP_URL}/reset-password/${token}`.
3. `/reset-password/[token]` validates the hash, expiry and that `usedAt` is null.
4. On success: update the hash, set `usedAt`, and delete all of that user's sessions.

Admins can also set a password directly from the employee edit screen, which sets
`mustChangePassword = true`. When that flag is set, every portal route redirects to
`/change-password` until it clears.

---

## 5. Data model

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role       { ADMIN EMPLOYEE }
enum MaterialKind { PDF IMAGE }
enum Visibility { ALL DEPARTMENTS }

model Department {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  users     User[]
  materials MaterialDepartment[]
  createdAt DateTime @default(now())
}

model User {
  id                 String   @id @default(cuid())
  name               String
  email              String   @unique
  passwordHash       String
  role               Role     @default(EMPLOYEE)
  departmentId       String?
  department         Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  employeeCode       String?  @unique
  designation        String?
  phone              String?
  isActive           Boolean  @default(true)
  mustChangePassword Boolean  @default(false)
  lastLoginAt        DateTime?
  sessions           Session[]
  resetTokens        PasswordResetToken[]
  uploads            Material[] @relation("UploadedBy")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([departmentId])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  ip        String?
  userAgent String?  @db.Text
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

model LoginAttempt {
  id        String   @id @default(cuid())
  email     String
  ip        String
  success   Boolean
  createdAt DateTime @default(now())

  @@index([email, createdAt])
  @@index([ip, createdAt])
}

model Category {
  id        String     @id @default(cuid())
  name      String     @unique
  slug      String     @unique
  sortOrder Int        @default(0)
  materials Material[]
}

model Material {
  id           String   @id @default(cuid())
  title        String
  description  String?  @db.Text
  kind         MaterialKind
  storageKey   String   @unique   // uuid filename on disk, e.g. "9f1c….pdf"
  originalName String
  mimeType     String
  sizeBytes    Int
  categoryId   String?
  category     Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  visibility   Visibility @default(DEPARTMENTS)
  departments  MaterialDepartment[]
  uploadedById String?
  uploadedBy   User?    @relation("UploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([categoryId])
  @@index([visibility])
}

model MaterialDepartment {
  materialId   String
  departmentId String
  material     Material   @relation(fields: [materialId], references: [id], onDelete: Cascade)
  department   Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@id([materialId, departmentId])
  @@index([departmentId])
}

model ContactEnquiry {
  id        String   @id @default(cuid())
  name      String
  email     String
  phone     String?
  subject   String?
  message   String   @db.Text
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // "material.upload", "employee.delete", "auth.login", …
  entity    String
  entityId  String?
  meta      Json?
  ip        String?
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

`Material.uploadedById` is optional with `onDelete: SetNull` rather than the default
`Restrict`. Employees who have ever uploaded a file would otherwise be permanently
undeletable — the FK would block `DELETE` on their `User` row. Deleting an employee who
uploaded materials keeps those materials (with `uploadedById` cleared); the admin
delete-employee confirm dialog (§6) should still name how many materials will lose their
attribution before confirming.

### The one query that matters

Materials visible to an employee:

```ts
where: {
  OR: [
    { visibility: 'ALL' },
    user.departmentId
      ? { departments: { some: { departmentId: user.departmentId } } }
      : { id: '__none__' },   // no department → sees only ALL items
  ],
}
```

Put this in `lib/queries/materials.ts` as `visibleMaterialsWhere(user)` and use it in
**every** employee-facing read, including the single-material page and the file stream
route. Do not re-derive it inline anywhere.

Admins bypass it entirely.

---

## 6. Routes

### Public
| Path | Notes |
|---|---|
| `/` | Home |
| `/about` | About |
| `/services` | Services |
| `/information` | Gallery / information |
| `/contact` | Contact form → Server Action → saves `ContactEnquiry` + SMTP notify |

Shared marketing header/footer. Header shows a "Employee Login" button.

### Auth
`/login` · `/forgot-password` · `/reset-password/[token]` · `/change-password`

### Portal — `EMPLOYEE` and `ADMIN`
| Path | Notes |
|---|---|
| `/portal` | Recently added materials, counts by category |
| `/portal/materials` | List with category filter, kind filter (PDF/image), text search, pagination |
| `/portal/materials/[id]` | Detail; inline PDF viewer in an `<iframe>` pointed at the file route, or `<img>` for images; download button |

### Admin — `ADMIN` only
| Path | Notes |
|---|---|
| `/admin` | Counts: employees, active employees, materials, unread enquiries; recent audit entries |
| `/admin/materials` | Table with filters, edit and delete |
| `/admin/materials/new` | Upload form: file, title, description, category, visibility (All / pick departments) |
| `/admin/materials/[id]` | Edit metadata and visibility; replace file; delete |
| `/admin/categories` | CRUD, inline |
| `/admin/departments` | CRUD; warn before delete if employees or materials are attached |
| `/admin/employees` | Table: name, email, department, designation, status, last login |
| `/admin/employees/new` | Create; generates a temporary password, emails it, sets `mustChangePassword` |
| `/admin/employees/[id]` | Edit, deactivate/reactivate, set password, delete (confirm dialog) |
| `/admin/enquiries` | Contact submissions, mark read |

### API route handlers
| Path | Purpose |
|---|---|
| `POST /api/materials/upload` | Multipart upload. `runtime = 'nodejs'`. Admin only. |
| `GET /api/materials/[id]/file` | Auth + visibility check, then stream. `?download=1` for attachment disposition. |

---

## 7. File handling

**Upload** (`/api/materials/upload`):
1. `requireAdmin()`.
2. Read `formData`, get the `File`.
3. Reject over 25 MB before reading the whole buffer.
4. Sniff magic bytes: `%PDF-` for PDF, `\x89PNG`, `\xFF\xD8\xFF` for JPEG, `RIFF`+`WEBP`.
   Reject if the sniffed type disagrees with the declared MIME type.
5. `storageKey = ${randomUUID()}.${ext}`. Write to `path.join(STORAGE_DIR, 'materials', storageKey)`.
   `ext` comes from the sniffed type, never from the upload.
6. Create the `Material` row plus `MaterialDepartment` rows in a transaction. If the DB
   write fails, unlink the file.
7. Write an `AuditLog` entry.

**Stream** (`/api/materials/[id]/file`):
1. `requireUser()`.
2. Load the material. If the user is not an admin, re-apply `visibleMaterialsWhere(user)`.
   A 404 — not a 403 — when it does not match, so the route does not confirm existence.
3. `fs.createReadStream` → `Response` with `Content-Type`, `Content-Length`,
   `Content-Disposition: inline; filename="<sanitised original name>"`
   (`attachment` when `?download=1`), and `Cache-Control: private, no-store`.
4. Support HTTP range requests so PDF viewers can seek.

**Delete**: remove the row, then unlink the file. A missing file is not an error.

---

## 8. Email

`lib/mail.ts` — one nodemailer transport, created once and reused.
Three templates, plain HTML with an inline-styled table, no external images:

- **Password reset** — link, 1-hour expiry note
- **New account** — temporary password and login URL
- **Contact enquiry** — to `CONTACT_NOTIFY_EMAIL`, with `replyTo` set to the enquirer

Sending failures must never break the user-facing action: catch, log, and carry on. For
contact enquiries the row is already saved, so the office does not lose the lead.

---

## 9. Security headers

Set these on every response, via `next.config.ts` `headers()` or middleware:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (safe to send
  unconditionally once TLS is live in production — Nginx/certbot terminates it)
- `Content-Security-Policy`, at minimum `default-src 'self'; frame-ancestors 'self'`

**Do not set `X-Frame-Options: DENY` or `frame-ancestors 'none'` globally.**
`/portal/materials/[id]` embeds the PDF viewer in a same-origin `<iframe>` pointed at
`GET /api/materials/[id]/file`. `frame-ancestors 'self'` (or `X-Frame-Options: SAMEORIGIN`
if using the header form instead of CSP) permits that same-origin embed while still
blocking any other site from framing the portal.

The file-streaming route keeps sending `Cache-Control: private, no-store` on top of these
defaults (already required by §7), since it serves per-user content.

## 10. UI

- `app/(marketing)/layout.tsx` — public header + footer
- `app/(app)/layout.tsx` — authenticated shell: sidebar (collapsible on mobile), user
  menu with sign-out, admin nav section rendered only for admins
- Toasts via `sonner`. Destructive actions go through shadcn `alert-dialog` and name the
  thing being deleted.
- Every table has a real empty state, not a blank box.
- Loading UI via `loading.tsx` and shadcn `skeleton`.
- The whole thing must work at 360 px wide — tables become stacked cards on mobile.
- Ask Darshit for the client's colours and logo before finalising the marketing pages;
  until then use neutral placeholders and clearly marked lorem content.

---

## 11. Seed

`prisma/seed.ts` creates:
- Departments: Administration, Accounts, Operations, Sales
- Categories: Policies, Training Material, Forms, Circulars, Photos
- One admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, `mustChangePassword = true`
- Three sample employees across different departments (dev only)

Never seed sample data when `NODE_ENV === 'production'` except the admin.

---

## 12. Phases

Finish each phase completely, run typecheck + lint + build, then commit before starting
the next one.

| Phase | Deliverable |
|---|---|
| 0 | Scaffold, Tailwind, shadcn init, `lib/env.ts`, Prisma connected, `.env.example` |
| 1 | Full schema, first migration, seed script running |
| 2 | Auth end to end: login, logout, throttling, forgot/reset, change-password, `requireUser` / `requireAdmin`, middleware redirect |
| 3 | Five public pages + contact form + enquiry email |
| 4 | Employee portal: list, filters, search, detail, file streaming with range support |
| 5 | Admin: materials CRUD + upload, categories, departments, employees CRUD, enquiries |
| 6 | Audit log wired into every mutation, security headers (§9), final validation pass, README |
| 7 | Deployment: `ecosystem.config.js` for PM2, Nginx server block, certbot notes, `mysqldump` backup cron, `docs/DEPLOY.md` |

---

## 13. Manual test script — must pass before handover

1. Logged out, hit `/portal/materials` → redirected to `/login`.
2. Copy a file URL from a logged-in session, open it in a private window → 404, not the file.
3. Log in as an Accounts employee. Materials restricted to Operations are absent from the
   list **and** their direct URLs 404.
4. A material set to visibility `ALL` appears for every department.
5. Admin deactivates an employee who is currently logged in. That employee's next request
   lands on `/login`.
6. Six wrong passwords in a row → locked out for 15 minutes with a generic message.
7. Password reset link works once; the second use is rejected. Using it kills existing
   sessions.
8. Upload a `.exe` renamed to `.pdf` → rejected.
9. Upload a 30 MB PDF → rejected with a clear message.
10. Delete a material → file is gone from `STORAGE_DIR`.
11. A new employee created by the admin receives the email and is forced to change the
    password on first login.
12. Contact form saves the row and sends the notification; a broken SMTP config still
    saves the row.
13. Every page usable at 360 px.
14. `curl -I https://domain/robots.txt` disallows all; page source carries `noindex`.
15. From two different machines behind the same NAT (or `curl` with a spoofed
    `X-Forwarded-For` from an untrusted hop), confirm the app keys throttling off the
    Nginx-forwarded address, not a single shared IP — one machine's lockout doesn't lock
    out the other.
16. Six rapid `/forgot-password` submissions, then six rapid `/contact` submissions, from
    the same IP → both throttle with a generic message; legitimate use from a different IP
    still works.
17. Delete an employee who has uploaded materials → succeeds; their materials remain,
    listed with no uploader.
18. Load `/portal/materials/[id]` while logged in → the PDF/image renders inside the page
    (iframe not blocked by CSP/`X-Frame-Options`); loading the same file URL directly in a
    tab from a third-party origin's `<iframe>` is refused.

---

## 14. Deployment notes

- Node LTS via `nvm`, MySQL 8 on the same VPS.
- `npm run build` then `pm2 start ecosystem.config.js`, `pm2 save`, `pm2 startup`.
- Nginx reverse-proxies `:3000`, sets `client_max_body_size 30M` (must exceed the 25 MB
  upload cap), and terminates TLS via certbot.
- Nginx must also set `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and
  `proxy_set_header X-Real-IP $remote_addr;` on that block. Without them every login,
  reset, and contact submission arrives from `127.0.0.1` and the per-IP throttling in §4
  becomes a single shared bucket for all users. `TRUST_PROXY_HOPS=1` (§3) tells the app to
  read the client address from that header rather than the socket.
- `STORAGE_DIR` is outside the repo so a redeploy never touches uploads. Back it up
  alongside the database.
- Nightly cron: `mysqldump` plus a `tar` of `STORAGE_DIR`, 14-day retention.
- The client owns the VPS account; hand over credentials in writing at go-live.

---

## 15. Open items to confirm with Darshit

- Client's brand colours, logo and final copy for the five public pages
- Real department names (the seed list is a guess)
- Whether employees should be able to edit their own profile or only their password
- Whether uploads need a "notify department by email" option
