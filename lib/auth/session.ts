import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";

const COOKIE_NAME = "vw_session";
const SESSION_DAYS = 7;
const RENEW_THRESHOLD_HOURS = 24;

// The cookie's own Max-Age is intentionally longer than the sliding 7-day session
// window. Next.js only allows writing cookies from a Server Action or Route Handler,
// never from a plain Server Component render — so getCurrentUser() (called from every
// page) cannot re-issue Set-Cookie to slide the cookie's expiry on a normal page view.
// Instead the cookie is just a long-lived carrier for the token; Session.expiresAt in
// the database is the real authority. getCurrentUser() slides that value forward (a
// plain DB write, allowed anywhere) whenever under 24h remain, and treats the session
// as dead once it passes — regardless of how much longer the browser would hold the
// cookie for.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  mustChangePassword: boolean;
}

export async function createSession(userId: string, ip: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ip, userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Reads the session for the current request. Returns `null` for: no cookie, no
 * matching session row, an expired session, or a deactivated user (BUILD-PLAN §4).
 * Wrapped in React's `cache()` so multiple calls within one render pass (layout, page,
 * nested components) share a single DB round trip instead of repeating it.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) return null;

  const msRemaining = session.expiresAt.getTime() - Date.now();
  if (msRemaining < RENEW_THRESHOLD_HOURS * 60 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) },
    });
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    departmentId: session.user.departmentId,
    mustChangePassword: session.user.mustChangePassword,
  };
});

/**
 * Call at the top of every protected page, Server Action, and Route Handler
 * (CLAUDE.md rule 2 — a shared layout is not enough, see Next.js's own guidance on
 * why auth checks in layouts don't re-run on client-side navigation). Redirects to
 * `/login` when there's no session, or to `/change-password` when one is forced.
 * `nextPath` is the page's own route, used to send the user back after login.
 */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return user;
}

/**
 * Used only by `/change-password` itself. `requireUser()` would otherwise redirect a
 * user with `mustChangePassword` set back to this same page in a loop.
 */
export async function requireUserForPasswordChange(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Additionally redirects non-admins to `/portal` (BUILD-PLAN §4, CLAUDE.md rule 4). */
export async function requireAdmin(nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "ADMIN") {
    redirect("/portal");
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Called on deactivation/deletion (rule 7) and password reset — revokes every device. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
