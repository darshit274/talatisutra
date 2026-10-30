# Self-Registration + Email OTP + Employee→User Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor self-register on the public site with email-OTP verification, auto-logging them in as a department-less account that can only see `ALL`-visibility materials, and rename "Employee" to "User" across every user-facing label.

**Architecture:** Two Prisma schema additions (`User.emailVerified`, a new `EmailOtp` model mirroring the existing `PasswordResetToken` pattern) plus two new enum values on `LoginAttemptKind`, landed in one migration. New `/register` and `/verify-email` routes under the existing `app/(auth)/` group follow the exact Server Action + `useActionState` form pattern already used by `/login`, `/forgot-password`, and `/reset-password/[token]`. The rename is pure display-text edits across existing files — no schema or route changes, fully independent of the registration backend, and safe to do in parallel.

**Tech Stack:** Next.js 16 Server Actions, Prisma 6.19.3/MySQL, Zod, bcryptjs, nodemailer (existing SMTP config — no new provider), `node:crypto` (OTP generation + hashing, matching `lib/auth/tokens.ts`'s existing pattern).

**Spec:** `docs/superpowers/specs/2026-10-07-self-registration-design.md` — read it alongside this plan; this plan implements it task-by-task but the spec carries the full rationale for each decision.

**This project has no automated test framework** (no vitest/jest in `package.json`). Its established verification convention (every prior phase, per git history) is `npx tsc --noEmit` + `npm run lint` + `npm run build`, plus direct manual verification (a `node -e` script against Prisma, `curl`, or a described browser step). Steps below follow that convention instead of inventing a test suite that doesn't match the codebase.

## Global Constraints

- `npx tsc --noEmit`, `npm run lint`, and `npm run build` must all pass before any task is considered done (`CLAUDE.md`).
- No new npm dependencies — everything uses packages already installed.
- Validate every input with Zod at the server boundary (`CLAUDE.md`).
- Never trust role/department from client input — self-registered accounts are hardcoded to `role: "EMPLOYEE"`, `departmentId: null` server-side, never read from form data (`CLAUDE.md` rule 3).
- Passwords: bcrypt cost 12, via the existing `hashPassword()` helper — never hand-roll hashing (`CLAUDE.md` rule 9).
- Rename internal identifiers (Prisma enum, route segments, component/variable names) **never** — only rendered/user-facing strings change (spec §1).
- Commit after each task.

## Review Focus

- **Duplicate/case-variant email at registration** — `prisma.user.findUnique({ where: { email } })` must catch it before creating a row; a reasonable person expects "email already registered" not a Prisma unique-constraint crash. (Task 3)
- **Expired or already-used OTP code resubmitted** — both must produce the same generic "invalid or expired" error, not distinguish which, so a brute-forcer can't learn which codes almost worked. (Task 4)
- **An unverified account trying to log in with the correct password** — must redirect to `/verify-email`, not silently fail or silently succeed; also must count as a *successful* login attempt for throttling purposes, or a legitimate user could lock themselves out just by having an unverified account (spec's Login Gate section). (Task 5)
- **Weak password submitted at registration** (e.g. `"password"`, `"12345678"`) — the strong-password regex must reject it with a specific, actionable message, not a generic "invalid password." (Task 2)
- **Resending a code must invalidate the previous one** — otherwise an old, possibly-leaked code stays valid alongside the new one. (Task 4)

---

## Task 1: Schema migration — `emailVerified`, `EmailOtp`, new throttle kinds

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.emailVerified: boolean` (Prisma Client field), `prisma.emailOtp` model with `{ id, userId, codeHash, expiresAt, usedAt, createdAt }`, `LoginAttemptKind` enum values `"REGISTRATION"` and `"EMAIL_OTP_VERIFY"` (usable as the `kind` field value in `prisma.loginAttempt.create`/`.count`).

- [ ] **Step 1: Add `emailVerified` to `User`**

In `prisma/schema.prisma`, find the `User` model (starts `model User {`) and add this field right after `mustChangePassword`:

```prisma
  mustChangePassword Boolean               @default(false)
  emailVerified      Boolean               @default(true)
```

Default `true` at the schema level (not `false`) is deliberate: every *existing* row (all admin-created so far) must come through the migration already verified, since nothing in their creation flow ever set this field. Task 3's registration code will explicitly pass `emailVerified: false` when creating a self-registered account, overriding this default for that one call site only.

Also add the inverse relation, right after `resetTokens`:

```prisma
  resetTokens        PasswordResetToken[]
  emailOtps          EmailOtp[]
```

- [ ] **Step 2: Add the `EmailOtp` model**

Add this new model directly after the closing `}` of `PasswordResetToken` (which ends around line 79):

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

- [ ] **Step 3: Extend `LoginAttemptKind`**

Find `enum LoginAttemptKind { LOGIN PASSWORD_RESET CONTACT_FORM }` and add two values:

```prisma
enum LoginAttemptKind {
  LOGIN
  PASSWORD_RESET
  CONTACT_FORM
  REGISTRATION
  EMAIL_OTP_VERIFY
}
```

- [ ] **Step 4: Generate and apply the migration**

Run: `npx prisma migrate dev --name self_registration`

Expected: a new folder under `prisma/migrations/` named `<timestamp>_self_registration`, and the command exits 0 printing "Your database is now in sync with your schema."

- [ ] **Step 5: Verify the Prisma Client picked up the new types**

Run: `npx tsc --noEmit`

Expected: no errors. (This alone proves the generated client exposes `prisma.emailOtp` and `User.emailVerified` with correct types, since nothing references them yet — a real exercise of the new types happens in Task 3+.)

- [ ] **Step 6: Verify existing rows were defaulted correctly**

Run:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.user.findMany({ select: { email: true, emailVerified: true } });
  console.log(rows);
  await prisma.$disconnect();
})();
'
```
Expected: every existing user row shows `emailVerified: true`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Add emailVerified, EmailOtp model, and registration throttle kinds"
```

---

## Task 2: Throttle helpers, strong-password schema, OTP mail template

**Depends on:** Task 1 (needs the `REGISTRATION`/`EMAIL_OTP_VERIFY` enum values and `EmailOtp` model to exist for type-checking, though this task's own code doesn't touch `EmailOtp` directly).

**Files:**
- Modify: `lib/auth/throttle.ts`
- Modify: `lib/validation/auth.ts`
- Modify: `lib/mail.ts`

**Interfaces:**
- Produces: `isRegistrationThrottled(email: string, ip: string): Promise<boolean>`, `recordRegistrationAttempt(email: string, ip: string): Promise<void>`, `isOtpVerifyThrottled(email: string, ip: string): Promise<boolean>`, `recordOtpVerifyAttempt(email: string, ip: string, success: boolean): Promise<void>`, `registerSchema` (Zod, fields: `name`, `email`, `phone`, `password`, `confirmPassword`, `website` honeypot), `verifyEmailSchema` (Zod, fields: `email`, `code`), `sendEmailOtp(to: string, code: string): Promise<void>`.

- [ ] **Step 1: Add registration throttle functions**

In `lib/auth/throttle.ts`, append (after the existing `recordContactFormSubmission`):

```ts
/**
 * Same 5-per-15-minutes window as the other public forms (BUILD-PLAN §4 fix #6),
 * applied to /register so it can't be used to mass-create accounts or flood an inbox.
 */
export async function isRegistrationThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "REGISTRATION", email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "REGISTRATION", ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordRegistrationAttempt(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success: true, kind: "REGISTRATION" } });
}

/**
 * Same window applied to OTP code submissions, so a code can't be brute-forced (only
 * 6 digits = 1,000,000 possibilities, but 5 tries per 15 minutes makes that infeasible
 * before the 10-minute expiry anyway).
 */
export async function isOtpVerifyThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "EMAIL_OTP_VERIFY", success: false, email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "EMAIL_OTP_VERIFY", success: false, ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordOtpVerifyAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success, kind: "EMAIL_OTP_VERIFY" } });
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `"REGISTRATION"`/`"EMAIL_OTP_VERIFY"` are valid `LoginAttemptKind` literals from Task 1's migration).

- [ ] **Step 3: Add `registerSchema` and `verifyEmailSchema`**

In `lib/validation/auth.ts`, append:

```ts
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Full name is required.").max(200),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number.")
      .max(20)
      .regex(/^[0-9+\-() ]+$/, "Enter a valid phone number."),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[0-9]/, "Include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Include at least one symbol."),
    confirmPassword: z.string(),
    website: z.string().max(0, "Invalid submission.").optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code."),
});
```

The `website` field is the honeypot — `z.string().max(0)` rejects anything a human never fills in but a bot might.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Add `sendEmailOtp` to `lib/mail.ts`**

Append this function (after `sendNewAccountEmail`):

```ts
export async function sendEmailOtp(to: string, code: string): Promise<void> {
  await safeSend({
    to,
    subject: "Confirm your account",
    html: emailShell(
      "Confirm your account",
      `
        <p style="margin: 0 0 16px; color: #333;">
          Use the code below to confirm your email address and finish creating your
          account. It expires in 10 minutes.
        </p>
        <p style="margin: 0 0 16px; font-size: 28px; font-weight: 600; letter-spacing: 4px; color: #111;">
          ${escapeHtml(code)}
        </p>
        <p style="margin: 0; color: #666; font-size: 13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `,
    ),
  });

  // Local dev has no real SMTP configured (see .env's SMTP comments — sends already
  // fail silently there), so registration would otherwise be untestable end-to-end
  // without this. Unlike other mail flows, the user is *blocked* without this code.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] Email OTP for ${to}: ${code}`);
  }
}
```

- [ ] **Step 6: Run full validation**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/throttle.ts lib/validation/auth.ts lib/mail.ts
git commit -m "Add registration/OTP throttle helpers, strong-password schema, OTP email"
```

---

## Task 3: Registration backend

**Depends on:** Task 1 (schema), Task 2 (`registerSchema`, `isRegistrationThrottled`, `recordRegistrationAttempt`, `sendEmailOtp`).

**Files:**
- Create: `app/(auth)/register/actions.ts`

**Interfaces:**
- Consumes: `registerSchema`, `isRegistrationThrottled`, `recordRegistrationAttempt` (from `lib/auth/throttle.ts`), `sendEmailOtp` (from `lib/mail.ts`), `hashPassword` (from `lib/auth/password.ts`), `hashToken` (from `lib/auth/tokens.ts` — reused to hash the OTP code the same way reset tokens are hashed), `getClientIp` (from `lib/auth/ip.ts`).
- Produces: `register(prevState: RegisterState, formData: FormData): Promise<RegisterState>` where `RegisterState = { error?: string }`. On success, calls `redirect("/verify-email?email=" + encodeURIComponent(email))` (throws, does not return).

- [ ] **Step 1: Write `app/(auth)/register/actions.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { getClientIp } from "@/lib/auth/ip";
import { isRegistrationThrottled, recordRegistrationAttempt } from "@/lib/auth/throttle";
import { sendEmailOtp } from "@/lib/mail";
import { registerSchema } from "@/lib/validation/auth";

export interface RegisterState {
  error?: string;
}

const THROTTLED_ERROR = "Too many attempts. Try again in a few minutes.";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function register(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    // A non-empty honeypot fails validation (max(0)) and lands here too — same
    // generic message, no signal to a bot about why.
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { name, email, phone, password } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isRegistrationThrottled(email, ip)) {
    return { error: THROTTLED_ERROR };
  }

  await recordRegistrationAttempt(email, ip);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: "EMPLOYEE",
      departmentId: null,
      isActive: true,
      mustChangePassword: false,
      emailVerified: false,
    },
  });

  const code = randomInt(100000, 1000000).toString();
  await prisma.emailOtp.create({
    data: {
      userId: user.id,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendEmailOtp(user.email, code);

  redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
}
```

Note: `role` and `departmentId` are hardcoded here, never read from `formData` — the public registration form has no role/department fields at all (Task 6), so there is nothing a client could even attempt to smuggle in, but the hardcoding is also the enforcement point per `CLAUDE.md` rule 3.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify end-to-end via a script** (no UI exists yet — this exercises the action's logic directly against the dev DB)

Run:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const before = await prisma.user.count({ where: { email: "plan-test@example.dev" } });
  console.log("before:", before);
  await prisma.$disconnect();
})();
'
```
Expected: `before: 0` (confirms the test email is free; delete it first with a quick `prisma.user.delete` if a previous run left it behind). Full exercise of the action itself happens once Task 6's UI exists — this step is just confirming the DB is in a clean state to test against.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/register/actions.ts"
git commit -m "Add registration Server Action with email OTP"
```

---

## Task 4: Verify-email backend

**Depends on:** Task 1 (schema), Task 2 (`verifyEmailSchema`, `isOtpVerifyThrottled`, `recordOtpVerifyAttempt`, `sendEmailOtp`).

**Files:**
- Create: `app/(auth)/verify-email/actions.ts`

**Interfaces:**
- Consumes: `verifyEmailSchema`, throttle functions from Task 2, `hashToken` (`lib/auth/tokens.ts`), `createSession` (`lib/auth/session.ts`), `getClientIp` (`lib/auth/ip.ts`).
- Produces: `verifyEmail(prevState: VerifyEmailState, formData: FormData): Promise<VerifyEmailState>` where `VerifyEmailState = { error?: string }` — on success calls `redirect("/portal")`. `resendOtp(prevState: ResendState, formData: FormData): Promise<ResendState>` where `ResendState = { sent?: boolean; error?: string }` — the email comes from a hidden form field, same as `verifyEmail`.

- [ ] **Step 1: Write `app/(auth)/verify-email/actions.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/ip";
import { isOtpVerifyThrottled, recordOtpVerifyAttempt, isRegistrationThrottled } from "@/lib/auth/throttle";
import { sendEmailOtp } from "@/lib/mail";
import { verifyEmailSchema } from "@/lib/validation/auth";

export interface VerifyEmailState {
  error?: string;
}

export interface ResendState {
  sent?: boolean;
  error?: string;
}

const INVALID_CODE_ERROR = "That code is invalid or has expired.";
const THROTTLED_ERROR = "Too many attempts. Try again in a few minutes.";
const OTP_TTL_MS = 10 * 60 * 1000;

export async function verifyEmail(_prevState: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: INVALID_CODE_ERROR };
  }

  const { email, code } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isOtpVerifyThrottled(email, ip)) {
    return { error: THROTTLED_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const otp = user
    ? await prisma.emailOtp.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const isValid =
    !!user && !!otp && otp.expiresAt > new Date() && otp.codeHash === hashToken(code);

  await recordOtpVerifyAttempt(email, ip, isValid);

  if (!isValid || !user || !otp) {
    return { error: INVALID_CODE_ERROR };
  }

  await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, lastLoginAt: new Date() } }),
  ]);

  await createSession(user.id, ip, headersList.get("user-agent"));

  redirect("/portal");
}

export async function resendOtp(_prevState: ResendState, formData: FormData): Promise<ResendState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: INVALID_CODE_ERROR };
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Reuses the registration throttle bucket — resending is the same cost to the
  // system (one more email send) as the original registration request.
  if (await isRegistrationThrottled(email, ip)) {
    return { error: THROTTLED_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    // Same response whether the account exists or is already verified — don't leak
    // which, matching the forgot-password pattern.
    return { sent: true };
  }

  await prisma.emailOtp.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = randomInt(100000, 1000000).toString();
  await prisma.emailOtp.create({
    data: { userId: user.id, codeHash: hashToken(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  await sendEmailOtp(user.email, code);

  return { sent: true };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/verify-email/actions.ts"
git commit -m "Add verify-email Server Action with resend"
```

---

## Task 5: Login gate for unverified accounts

**Depends on:** Task 1 (`User.emailVerified` field must exist).

**Files:**
- Modify: `app/(auth)/login/actions.ts:50-57`

**Interfaces:**
- Consumes: nothing new — uses the existing `user` object already fetched in this action, which now carries `emailVerified`.

- [ ] **Step 1: Insert the verification gate**

In `app/(auth)/login/actions.ts`, the current lines 50-57 read:

```ts
  await recordLoginAttempt(email, ip, isValid && !!user?.isActive);

  if (!user || !isValid || !user.isActive) {
    return { error: GENERIC_ERROR };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, ip, headersList.get("user-agent"));
  await writeAuditLog({ actor: user, action: "auth.login", entity: "User", entityId: user.id, ip });
```

Replace with:

```ts
  await recordLoginAttempt(email, ip, isValid && !!user?.isActive);

  if (!user || !isValid || !user.isActive) {
    return { error: GENERIC_ERROR };
  }

  if (!user.emailVerified) {
    // Credentials were correct — this already counted as a successful attempt above,
    // so an unverified-but-legitimate user can't get throttled out of their own
    // account by the login lockout (CLAUDE.md rule: never penalize a correct
    // password). Redirect rather than erroring so they land somewhere useful.
    redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, ip, headersList.get("user-agent"));
  await writeAuditLog({ actor: user, action: "auth.login", entity: "User", entityId: user.id, ip });
```

`redirect` is already imported in this file (used at the bottom for the post-login redirect), so no new import is needed.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/actions.ts"
git commit -m "Redirect unverified accounts to /verify-email on login instead of signing them in"
```

---

## Task 6: Registration page + form

**Depends on:** Task 3 (`register` action, `RegisterState` type).

**Files:**
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/register/register-form.tsx`

**Interfaces:**
- Consumes: `register`, `RegisterState` from `./actions`.

- [ ] **Step 1: Write `app/(auth)/register/register-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register, type RegisterState } from "./actions";

const initialState: RegisterState = {};

// Visually hidden, not tab-reachable, out of the accessibility tree — mirrors
// app/(marketing)/contact/contact-form.tsx's HONEYPOT_CLASSES (not exported from
// there, so duplicated here rather than importing across unrelated features).
const HONEYPOT_CLASSES =
  "absolute h-px w-px -m-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className={HONEYPOT_CLASSES} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">
          At least 10 characters, with uppercase, lowercase, a number, and a symbol.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Write `app/(auth)/register/page.tsx`**

```tsx
import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a code to confirm your address.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; the build output's route list includes `/register`.

- [ ] **Step 4: Manually verify the full registration flow**

Start the dev server (`npm run dev`), open `http://localhost:3000/register`, fill in a real-looking test name/email/phone and a password meeting the strength rule (e.g. `Str0ng!Pass`), submit. Expected: redirected to `/verify-email?email=...` (Task 7 builds that page — until then this will 404, which is fine to confirm the redirect target is correct; the terminal running the dev server should log `[dev] Email OTP for <email>: <6-digit code>` per Task 2 Step 5).

Also confirm the strength rule actually rejects a weak password: resubmit the form with a different test email but password `password1` (meets length-10? no — it's 9 chars, will fail the `min(10)` check first) and separately with `passwordpassword` (16 chars, all lowercase). Expected for the second case: the form re-renders with the "Include at least one uppercase letter." error, no account created.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/register/page.tsx" "app/(auth)/register/register-form.tsx"
git commit -m "Add registration page and form"
```

---

## Task 7: Verify-email page + form

**Depends on:** Task 4 (`verifyEmail`, `resendOtp` actions and their state types).

**Files:**
- Create: `app/(auth)/verify-email/page.tsx`
- Create: `app/(auth)/verify-email/verify-email-form.tsx`

**Interfaces:**
- Consumes: `verifyEmail`, `VerifyEmailState`, `resendOtp`, `ResendState` from `./actions`.

- [ ] **Step 1: Write `app/(auth)/verify-email/verify-email-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmail, resendOtp, type VerifyEmailState, type ResendState } from "./actions";

const initialVerifyState: VerifyEmailState = {};
const initialResendState: ResendState = {};

export function VerifyEmailForm({ email }: { email: string }) {
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyEmail, initialVerifyState);
  const [resendState, resendAction, resendPending] = useActionState(resendOtp, initialResendState);

  return (
    <div className="space-y-6">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />

        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </div>

        {verifyState.error ? <p className="text-sm text-destructive">{verifyState.error}</p> : null}

        <Button type="submit" className="w-full" disabled={verifyPending}>
          {verifyPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        {resendState.sent ? (
          <p className="text-center text-sm text-muted-foreground">
            A new code has been sent, if that account needs one.
          </p>
        ) : (
          <Button type="submit" variant="ghost" className="w-full" disabled={resendPending}>
            {resendPending ? "Sending…" : "Resend code"}
          </Button>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(auth)/verify-email/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  if (!email) {
    redirect("/register");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to {email}. Enter it below to finish creating your
          account.
        </p>
      </div>
      <VerifyEmailForm email={email} />
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; route list includes `/verify-email`.

- [ ] **Step 4: Manually verify the full registration → verification → login loop**

With the dev server running: repeat Task 6 Step 4's registration (use a fresh test email), copy the 6-digit code from the server's console log, enter it on `/verify-email`. Expected: redirected to `/portal`, signed in as the new account, header shows the account's name. Then:
- Confirm `/portal/materials` only shows materials with `ALL` visibility (no department-scoped ones) — this account has `departmentId: null`.
- Sign out, sign back in with the same email/password at `/login` — should succeed normally now (`emailVerified` is `true`).
- Run a DB check to confirm end state:
```bash
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: "<the test email you used>" }, select: { emailVerified: true, departmentId: true, role: true } });
  console.log(user);
  await prisma.$disconnect();
})();
'
```
Expected: `{ emailVerified: true, departmentId: null, role: 'EMPLOYEE' }`.

- Test the invalid-code path: register another fresh test account, go to `/verify-email`, enter a wrong 6-digit code. Expected: generic "invalid or expired" error, no session created.
- Test resend: on that same page, click "Resend code", check the server console for a new code, confirm the *old* code (from the original registration email) no longer works (should hit the same generic error — it was marked `usedAt` by the resend).

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/verify-email/page.tsx" "app/(auth)/verify-email/verify-email-form.tsx"
git commit -m "Add verify-email page and form"
```

---

## Task 8: Entry-point links (Register link on login, marketing header)

**Depends on:** Task 6 (`/register` route must exist for these links to resolve).

**Files:**
- Modify: `app/(auth)/login/login-form.tsx`
- Modify: `app/(marketing)/_components/marketing-header.tsx`

**Interfaces:** none (pure UI additions, no new exports).

- [ ] **Step 1: Add a Register link to the login form**

In `app/(auth)/login/login-form.tsx`, the current final lines are:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
```

Replace with:

```tsx
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="underline underline-offset-4">
          Register
        </Link>
      </p>
```

- [ ] **Step 2: Add a Register button to the marketing header**

In `app/(marketing)/_components/marketing-header.tsx`, the desktop nav block currently reads:

```tsx
        <div className="hidden md:block">
          {/* Base UI's Button can't wrap a Link via render (see button.tsx) - style
              the Link directly with buttonVariants instead. */}
          <Link href="/login" className={buttonVariants()}>
            Employee Login
          </Link>
        </div>
```

Replace with (adds a Register link and renames "Employee Login" → "User Login" — this file is not touched by Task 9, so this is the only place that rename happens):

```tsx
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/register" className={buttonVariants({ variant: "ghost" })}>
            Register
          </Link>
          {/* Base UI's Button can't wrap a Link via render (see button.tsx) - style
              the Link directly with buttonVariants instead. */}
          <Link href="/login" className={buttonVariants()}>
            User Login
          </Link>
        </div>
```

And the mobile nav block currently reads:

```tsx
            <li>
              <Link
                href="/login"
                className={buttonVariants({ className: "w-full" })}
                onClick={() => setMobileOpen(false)}
              >
                Employee Login
              </Link>
            </li>
```

Replace with:

```tsx
            <li>
              <Link
                href="/register"
                className={buttonVariants({ variant: "ghost", className: "w-full" })}
                onClick={() => setMobileOpen(false)}
              >
                Register
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className={buttonVariants({ className: "w-full" })}
                onClick={() => setMobileOpen(false)}
              >
                User Login
              </Link>
            </li>
```

- [ ] **Step 3: Run typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 4: Manually verify**

Open `/login` — confirm a "Don't have an account? Register" link appears below "Forgot your password?" and navigates to `/register`. Open `/` (marketing home) — confirm both "Register" and "User Login" buttons appear in the header (desktop and, via the hamburger menu, mobile) and navigate correctly.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login/login-form.tsx" "app/(marketing)/_components/marketing-header.tsx"
git commit -m "Add Register entry points to login page and marketing header"
```

---

## Task 9: Employee → User rename (independent — can run in parallel with Tasks 1-8)

**Depends on:** nothing from this plan. Touches a disjoint set of files from every other task. Safe to implement concurrently with the registration backend/frontend work.

**Files:**
- Modify: `app/(app)/_components/app-shell.tsx`
- Modify: `app/(app)/admin/page.tsx`
- Modify: `app/(app)/admin/_components/dashboard-charts.tsx`
- Modify: `app/(app)/admin/employees/page.tsx`
- Modify: `app/(app)/admin/employees/[id]/page.tsx`
- Modify: `app/(app)/admin/employees/new/page.tsx`
- Modify: `app/(app)/admin/employees/employee-form.tsx`
- Modify: `app/(auth)/login/page.tsx`

**Interfaces:** none (pure display-text edits; no signatures change).

- [ ] **Step 1: `app/(app)/_components/app-shell.tsx`**

Change the `ADMIN_LINKS` entry (currently `{ href: "/admin/employees", label: "Employees", icon: Users }`) to:
```ts
  { href: "/admin/employees", label: "Users", icon: Users },
```

Change the header title line (currently `<span className="font-semibold">{isAdmin ? "Admin Portal" : "Employee Portal"}</span>`) to:
```tsx
          <span className="font-semibold">{isAdmin ? "Admin Portal" : "User Portal"}</span>
```

- [ ] **Step 2: `app/(app)/admin/page.tsx`**

Change the `stats` array's first two labels (currently `{ label: "Employees", value: summary.employeeCount }` and `{ label: "Active employees", value: summary.activeEmployeeCount }`) to:
```ts
    { label: "Users", value: summary.employeeCount },
    { label: "Active users", value: summary.activeEmployeeCount },
```
(The `summary.employeeCount`/`activeEmployeeCount` field names stay — internal identifiers, per spec §1.)

- [ ] **Step 3: `app/(app)/admin/_components/dashboard-charts.tsx`**

Change the chart title (currently `<CardTitle className="text-sm font-medium">Employees by department</CardTitle>`) to:
```tsx
          <CardTitle className="text-sm font-medium">Users by department</CardTitle>
```

- [ ] **Step 4: `app/(app)/admin/employees/page.tsx`**

Make these four changes:
- `export const metadata: Metadata = { title: "Employees" };` → `title: "Users"`
- `<h1 className="text-xl font-semibold">Employees</h1>` → `Users`
- `New employee` (button text) → `New user`
- `No employees yet.` (empty-state text) → `No users yet.`

Also replace the role badge. Find:
```tsx
                    <Badge variant={employeeRow.role === "ADMIN" ? "default" : "outline"}>
                      {employeeRow.role}
                    </Badge>
```
Add `import type { Role } from "@prisma/client";` to this file's imports (matches the
existing pattern in `lib/auth/session.ts`), then add this helper near the top of the
file, after the imports and before the component:
```ts
const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", EMPLOYEE: "User" };
```
Using the real `Role` type (not a hand-rolled `"ADMIN" | "EMPLOYEE"` union) means this
breaks at compile time if the enum ever gains a value, instead of silently rendering
`undefined` for it.
And change the badge to:
```tsx
                    <Badge variant={employeeRow.role === "ADMIN" ? "default" : "outline"}>
                      {ROLE_LABELS[employeeRow.role]}
                    </Badge>
```

- [ ] **Step 5: `app/(app)/admin/employees/[id]/page.tsx`**

Change `generateMetadata`'s fallback (currently `return { title: employee?.name ?? "Employee" };`) to:
```ts
  return { title: employee?.name ?? "User" };
```

- [ ] **Step 6: `app/(app)/admin/employees/new/page.tsx`**

Make these three changes:
- `export const metadata: Metadata = { title: "New employee" };` → `title: "New user"`
- `<h1 className="text-xl font-semibold">New employee</h1>` → `New user`
- `submitLabel="Create employee"` → `submitLabel="Create user"`

- [ ] **Step 7: `app/(app)/admin/employees/employee-form.tsx`**

Change `<SelectItem value="EMPLOYEE">Employee</SelectItem>` to:
```tsx
              <SelectItem value="EMPLOYEE">User</SelectItem>
```
(`value="EMPLOYEE"` stays — it's the Prisma enum constant.)

Change `<Label htmlFor="employeeCode">Employee code (optional)</Label>` to:
```tsx
          <Label htmlFor="employeeCode">User code (optional)</Label>
```
(The `id="employeeCode"`/`name="employeeCode"` attributes and the `employeeCode` Prisma field stay unchanged — only the rendered label text changes.)

- [ ] **Step 8: `app/(auth)/login/page.tsx`**

Change `<h1 className="text-2xl font-semibold">Employee sign in</h1>` to:
```tsx
        <h1 className="text-2xl font-semibold">Sign in</h1>
```

- [ ] **Step 9: Run full validation**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass.

- [ ] **Step 10: Manually verify**

Sign in as the seed admin, confirm: sidebar says "Users" not "Employees"; dashboard stat cards say "Users"/"Active users"; the "Users by department" chart title; the Users list page heading/button/empty-state; a user detail page's role badge shows "User" not "EMPLOYEE"; the "User code" field label on the create/edit form. Sign in as a seed employee account, confirm the header now says "User Portal". Visit `/login` logged out, confirm the heading just says "Sign in".

- [ ] **Step 11: Commit**

```bash
git add "app/(app)/_components/app-shell.tsx" "app/(app)/admin/page.tsx" "app/(app)/admin/_components/dashboard-charts.tsx" "app/(app)/admin/employees/page.tsx" "app/(app)/admin/employees/[id]/page.tsx" "app/(app)/admin/employees/new/page.tsx" "app/(app)/admin/employees/employee-form.tsx" "app/(auth)/login/page.tsx"
git commit -m "Rename Employee to User across all user-facing labels"
```

---

## Task 10: Documentation updates (independent — can run any time after the design is final)

**Depends on:** nothing functionally, but should describe the actual shipped behavior, so do this last if run sequentially; safe to parallelize if the implementer is confident the design won't change.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/BUILD-PLAN.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update `CLAUDE.md`'s out-of-scope list**

Find the "Out of scope — do not build" section's line:
```
Payment gateway, e-commerce, bulk email, live chat, mobile app, multi-language,
analytics, SEO tooling, employee self-signup.
```
Remove `employee self-signup` from that list (it's now built):
```
Payment gateway, e-commerce, bulk email, live chat, mobile app, multi-language,
analytics, SEO tooling.
```

- [ ] **Step 2: Add a new rule documenting the registration/verification model**

In `CLAUDE.md`'s "Security rules — never break these" section, add a new numbered rule after the existing rule 7 (renumber subsequent rules accordingly):

```
8. **Self-registered accounts require email verification before login** —
   `User.emailVerified` gates session creation in both `/login` and
   `/verify-email`'s own action. They also have no department by construction
   (`departmentId: null`, never settable from the registration form) and so only
   ever see `visibility: "ALL"` materials — there is no path to self-assign a
   department.
```

- [ ] **Step 3: Add a BUILD-PLAN section documenting the flow**

In `docs/BUILD-PLAN.md`, add a new section after the existing auth-related section (find where `/forgot-password` and `/reset-password` are documented, and add this immediately after that section):

```markdown
## Self-registration and email verification

`/register` creates a `User` row directly (`role: EMPLOYEE`, `departmentId: null`,
`emailVerified: false`) and emails a 6-digit code via the existing SMTP config
(`lib/mail.ts`'s `sendEmailOtp`) — no SMS/phone provider, by design (see
`docs/superpowers/specs/2026-10-07-self-registration-design.md` for the full
rationale). The code is hashed (`EmailOtp.codeHash`, same `hashToken()` helper as
password-reset tokens) and expires in 10 minutes.

`/verify-email` checks the code, marks the account verified, and auto-logs the user
in. `/login` redirects any `emailVerified: false` account to `/verify-email` instead
of creating a session, but still counts a correct password as a *successful* login
attempt for throttling purposes.

Self-registered accounts have no department and therefore only ever see materials
with `visibility: "ALL"` (existing logic in `lib/queries/materials.ts` already
handles `departmentId: null` this way — no change was needed there). There is no
in-app path for a self-registered account to acquire a department; that remains
admin-only, via the existing employee-edit form.

Admin-created accounts (via `/admin/employees/new`) are unaffected: they get
`emailVerified: true` at creation, since the admin already vouches for them.
```

- [ ] **Step 4: Verify the docs render sensibly**

Run: `cat CLAUDE.md docs/BUILD-PLAN.md | grep -c "employee self-signup"` — expected: `0` (confirms the out-of-scope line was actually removed, not just commented near).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/BUILD-PLAN.md
git commit -m "Document self-registration/email-verification flow; remove it from out-of-scope list"
```

---

## Task 11: Final validation pass (must run last — depends on every other task)

**Depends on:** Tasks 1-10, all complete.

**Files:** none modified — verification only.

- [ ] **Step 1: Full validation suite**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass with zero errors. The build's route list should include `/register` and `/verify-email` alongside every pre-existing route.

- [ ] **Step 2: Fresh end-to-end manual walkthrough**

With `npm run dev` running against a clean browser session:
1. Visit `/` (marketing home) → click "Register" → fill the form with a strong password → submit.
2. Confirm redirect to `/verify-email`, copy the code from the dev server's console log.
3. **Before entering the code**, open `/login` in a new tab and attempt to sign in with that same (still-unverified) email/password. Expected: redirected to `/verify-email`, *not* signed in — confirms the login gate from Task 5 actually blocks an unverified account rather than just looking correct in code review.
4. Back on `/verify-email`, enter the code → confirm redirect to `/portal`, signed in, header reads "User Portal".
5. Confirm `/portal/materials` shows only `ALL`-visibility materials.
6. Sign out, sign back in with the same credentials at `/login` (heading should just read "Sign in", with a "Register" link visible) → confirm normal login succeeds this time (no re-verification needed, since `emailVerified` is now `true`).
7. Sign in as the seed admin → confirm sidebar says "Users", dashboard stat cards say "Users"/"Active users", the "Users by department" chart renders, the Users list/detail/new pages all say "User" not "Employee", and the role badge for an employee-role account reads "User".
8. Attempt to register with an email that already has an account → confirm the "already exists" error.
9. Attempt `/verify-email` with a wrong code → confirm the generic invalid/expired error, no session created.

- [ ] **Step 3: Confirm no regressions in existing flows**

Spot-check: admin-created employee login still works without hitting the verification gate (their `emailVerified` should be `true` from Task 1's migration default / Task-1-era rows, and any *new* admin-created account should also come through as verified — confirm by creating one via `/admin/employees/new` and logging in as them immediately with the temp password, no `/verify-email` redirect should occur).

- [ ] **Step 4: Final commit if any cleanup was needed**

If Steps 1-3 required any fixes, commit them now with a message describing what was fixed. If everything passed clean, no commit needed for this task.
