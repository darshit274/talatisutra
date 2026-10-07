# Self-service registration + "Employee → User" rename

Status: approved design, ready for implementation plan.

## Context

The portal has only ever supported admin-created accounts (BUILD-PLAN's original
design, and `CLAUDE.md` explicitly listed "employee self-signup" as out of scope). The
client now wants a public registration flow so people can create their own account
directly from the website, confirmed via a code emailed to them, and wants the
"Employee" terminology renamed to "User" across the admin dashboard and public site to
match.

This is an intentional, explicit departure from the original scope, made with the
user's sign-off after flagging the conflict. `CLAUDE.md` and `docs/BUILD-PLAN.md` are
updated as part of this work to reflect the new scope (see §7).

Decisions already settled with the user before this spec was written:
- No SMS/phone OTP (would need a new paid provider). Email OTP instead, reusing the
  SMTP config already in `lib/mail.ts`.
- Self-registered accounts have no department and can only see materials with
  `visibility: "ALL"`. Confirmed in `lib/queries/materials.ts:14-17` that this already
  works for any user with `departmentId: null` — **no code change needed there**.
- Phone number is a required registration field but is stored only, not itself
  verified (email is what gets the OTP).

## 1. "Employee → User" rename — display text only

Every **user-facing string** changes from "Employee"/"Employees" to "User"/"Users".
Every **internal identifier** (Prisma `Role.EMPLOYEE`, the `app/(app)/admin/employees/`
route segment, `EmployeeForm`, variable names, file names, code comments) stays
unchanged. Renaming the enum value would require a data migration and touching every
`role === "EMPLOYEE"` check for zero functional benefit — not worth it for a label
change.

Concretely, this touches:
- `app/(app)/_components/app-shell.tsx`: `ADMIN_LINKS` label `"Employees"` → `"Users"`,
  and the header's `isAdmin ? "Admin Portal" : "Employee Portal"` → `"User Portal"` for
  the non-admin branch (keeps the parallel "Admin Portal" / "User Portal" naming).
- `app/(app)/admin/employees/page.tsx`: `<Metadata title>` `"Employees"` → `"Users"`,
  `<h1>` `"Employees"` → `"Users"`, `"New employee"` button → `"New user"`, `"No
  employees yet."` empty state → `"No users yet."`, and the role `<Badge>` — it
  currently prints the raw enum value (`{employeeRow.role}`, i.e. literally renders
  "EMPLOYEE" on screen) — replace with a small `ROLE_LABELS: Record<Role, string> =
  { ADMIN: "Admin", EMPLOYEE: "User" }` map so the badge shows "User", not the raw
  enum.
- `app/(app)/admin/employees/[id]/page.tsx`: `generateMetadata`'s fallback title
  `"Employee"` → `"User"`.
- `app/(app)/admin/employees/new/page.tsx`: `<Metadata title>` `"New employee"` →
  `"New user"`, `<h1>` `"New employee"` → `"New user"`, `submitLabel="Create
  employee"` → `"Create user"`.
- `app/(app)/admin/employees/employee-form.tsx`: the role `<SelectItem
  value="EMPLOYEE">Employee</SelectItem>` → `<SelectItem
  value="EMPLOYEE">User</SelectItem>` (value stays the enum constant, only the visible
  label changes), and the `"Employee code"` field label → `"User code"` (the
  underlying `employeeCode` Prisma field/variable name stays unchanged, per the
  internal-identifier rule above — only the rendered label changes).
- `app/(app)/admin/page.tsx` dashboard: "Employees" / "Active employees" stat card
  labels → "Users" / "Active users"; `lib/queries/admin.ts`'s
  `employeesByDepartment` chart title "Employees by department" → "Users by
  department" (the field/variable name in the return type can stay as-is internally —
  only the chart's rendered title text changes).
- `app/(marketing)/_components/marketing-header.tsx`: `"Employee Login"` → `"User
  Login"`.
- `app/(auth)/login/page.tsx`: `"Employee sign in"` heading → `"Sign in"`.
- `CLAUDE.md` / `docs/BUILD-PLAN.md`: prose referring to "employee" as the portal's
  non-admin user type now says "user" (see §7) — these are documentation, not a code
  rename, so no migration concern.

Do **not** touch: Prisma schema/model names, the `/admin/employees/*` URL paths
(changing URLs would be a breaking change to existing admin bookmarks/links for no
benefit), or internal variable/type names.

## 2. Data model changes

Two additions to `prisma/schema.prisma`, one new migration.

**`User` model** — add one field:
```prisma
emailVerified Boolean @default(false)
```
Admin-created accounts (`app/(app)/admin/employees/actions.ts`'s `createEmployee`) get
this set to `true` explicitly at creation — the admin already vouches for them by
creating the account and emailing them a temp password, so they must not be blocked by
the new verification gate.

**New `EmailOtp` model** (mirrors `PasswordResetToken`'s shape):
```prisma
model EmailOtp {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, createdAt])
}
```
Add the inverse relation field `emailOtps EmailOtp[]` to `User`. The code is a 6-digit
numeric string, hashed with the same `hashToken()` helper `lib/auth/tokens.ts` already
uses for reset tokens (SHA-256 is fine here — this is a short-lived, rate-limited,
single-use code, not a password). Expiry: 10 minutes.

**`LoginAttemptKind` enum** — add two values: `REGISTRATION`, `EMAIL_OTP_VERIFY`.

## 3. Registration + email OTP flow

### Routes (all under `app/(auth)/`, same unauthenticated layout as login)

- **`/register`** (new) — the registration form.
- **`/verify-email`** (new) — enter the 6-digit code; resend button.

### `app/(auth)/register/actions.ts` — `register(prevState, formData)`

1. Zod-validate: `name` (min 1), `email` (valid email), `phone` (required,
   `/^[0-9+\-() ]{7,20}$/` — permissive, this is a contact field not a verified
   channel), `password` + `confirmPassword` (must match; password must satisfy the
   strong-password schema below), plus an empty honeypot field (same pattern as
   `app/(marketing)/contact/contact-form.tsx`'s `HONEYPOT_CLASSES` — that constant
   isn't exported, so duplicate the same Tailwind class string locally in the register
   form rather than importing across unrelated features; a non-empty value silently
   no-ops the submit instead of erroring, so bots don't learn why).
2. Rate-limit via `isRegistrationThrottled(email, ip)` (new function in
   `lib/auth/throttle.ts`, same 5-per-15-minutes shape as
   `isPasswordResetThrottled`, `kind: "REGISTRATION"`).
3. If a `User` with this email already exists: return a generic error ("An account
   with this email already exists.") — fine to be specific here (unlike
   forgot-password) since registration uniqueness is already observable by trying to
   register twice.
4. Hash the password (`lib/auth/password.ts`'s existing `hashPassword`). Create the
   `User` row: `role: "EMPLOYEE"`, `departmentId: null`, `isActive: true`,
   `mustChangePassword: false`, `emailVerified: false`.
5. Generate a 6-digit code (`crypto.randomInt(100000, 1000000)`), hash it, create the
   `EmailOtp` row (`expiresAt: now + 10min`).
6. Send the code via a new `sendEmailOtp(to, code)` function in `lib/mail.ts` (same
   `emailShell()` template style as the existing functions). Wrapped in the existing
   `safeSend` — a mail failure must not crash registration (matches BUILD-PLAN §8's
   existing rule), but since the user cannot proceed without the code, the response
   still redirects to `/verify-email` (BUILD-PLAN's pattern of "always show success"
   applies to flows where silent failure is actually fine, e.g. forgot-password; here
   log the mail error server-side and let the resend button on `/verify-email` be the
   recovery path). **Local dev has no real SMTP configured** (per `.env`'s existing
   comment — sends fail silently there already); to keep registration testable without
   real SMTP, `sendEmailOtp` also `console.log`s the plaintext code when
   `NODE_ENV !== 'production'`, right after attempting the send. This mirrors no
   existing pattern (other flows don't need the user to see a secret value to proceed)
   but is required here since, unlike forgot-password, the user is *blocked* without
   the code.
7. Record the attempt (`recordRegistrationAttempt`), redirect to
   `/verify-email?email=<email>`.

### `app/(auth)/verify-email/actions.ts`

- **`verifyEmail(prevState, formData)`**: takes `email` + `code`. Rate-limited
  (`isOtpVerifyThrottled`, `kind: "EMAIL_OTP_VERIFY"`, same 5/15min shape, keyed by
  email+IP same as login). Looks up the user by email, the newest unused non-expired
  `EmailOtp` row for them, compares the hash. On match: `usedAt` set, `User.
  emailVerified = true`, then **auto-login** (reuse `createSession()` from
  `lib/auth/session.ts` — same call the login action makes) and redirect to `/portal`.
  On mismatch/expiry: generic error, do not reveal which.
- **`resendOtp(email)`**: same throttle, generates + emails a fresh code (reuses step
  5-6 above as a shared helper), invalidates (sets `usedAt: now`) any still-valid prior
  code for that user first so only the latest code works.

### Login gate

`app/(auth)/login/actions.ts`'s `login` action: after verifying the password but before
`createSession`, check `user.emailVerified`. If false, redirect to
`/verify-email?email=<email>` instead of creating a session (do this *after* password
verification, not before, so the check can't be used to enumerate which emails are
registered). Record this as a **successful** `recordLoginAttempt` call (the credentials
were correct — only the verification gate stopped the session) so a legitimate
not-yet-verified user can't get throttled out of their own account by the existing
5-per-15-minutes login lockout.

### Honeypot + throttle — no new dependency

Both anti-abuse mechanisms reuse exactly what's already in the codebase
(`contact-form.tsx`'s honeypot pattern, `lib/auth/throttle.ts`'s
`LoginAttempt`-table-based rate limiting). No CAPTCHA, no new package.

## 4. Password strength (registration only)

New schema in `lib/validation/auth.ts`, `registerSchema`'s password field:
```ts
z.string()
  .min(10, "Password must be at least 10 characters.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Include at least one symbol.")
```
This is scoped to registration only. The existing admin "set password" (min 8, no
complexity) and self-reset flows are unchanged — not in scope for this work.

## 5. Materials visibility

No code change. Verified: `lib/queries/materials.ts:14-17` already restricts a user
with `departmentId: null` to `visibility: "ALL"` materials.

## 6. Entry points

- `app/(auth)/login/login-form.tsx`: add `Don't have an account? <Link href="/register">
  Register</Link>` below the existing "Forgot your password?" link.
- `app/(marketing)/_components/marketing-header.tsx`: add a `"Register"` link (ghost/
  outline button style) next to the renamed `"User Login"` button, both desktop and
  mobile nav.

## 7. Documentation updates

- `CLAUDE.md`: remove "employee self-signup" from the "Out of scope" list; add a line
  under Security rules (or a new numbered rule) noting self-registered accounts require
  email verification before login, and have no department by construction (not
  assignable at registration).
- `docs/BUILD-PLAN.md`: add a short new section documenting the registration/OTP flow
  (route list, `EmailOtp` model, the `emailVerified` gate) so the spec's intent is
  discoverable later the same way every other flow is.

## Out of scope for this work

- Admin UI to view/manage `emailVerified` state or manually re-verify a user (can be
  added later if needed; not requested).
- Changing the admin-set/reset password rules to match the new strong-password regex.
- Any SMS/phone verification.
- Allowing a self-registered user to later request a department (would need an admin
  approval step; not requested — they explicitly only get `ALL`-visibility materials).

## Testing

- `npx tsc --noEmit`, `npm run lint`, `npm run build` must all pass (per `CLAUDE.md`'s
  existing rule) before this is considered done.
- Manual pass: register → check inbox (Mailtrap/Ethereal per local `.env`, or server
  console log if SMTP is unreachable) → verify with correct code → auto-logged in on
  `/portal` seeing only `ALL`-visibility materials → sign out → sign back in normally.
  Also: wrong code shows a generic error; expired code (10+ min) is rejected; resend
  invalidates the prior code; 6 rapid registration attempts from one IP get throttled;
  an unverified account attempting to log in is redirected to `/verify-email` instead
  of getting a session.
