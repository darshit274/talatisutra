"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/ip";
import { isLoginThrottled, recordLoginAttempt } from "@/lib/auth/throttle";
import { loginSchema } from "@/lib/validation/auth";
import { writeAuditLog } from "@/lib/audit";

export interface LoginState {
  error?: string;
}

const GENERIC_ERROR = "Incorrect email or password.";
const THROTTLED_ERROR = "Too many attempts. Try again in a few minutes.";

function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const { email, password } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isLoginThrottled(email, ip)) {
    return { error: THROTTLED_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Runs even when there's no user, against a dummy hash, so response time doesn't
  // reveal whether the email exists (lib/auth/password.ts).
  const isValid = await verifyPassword(password, user?.passwordHash ?? null);

  await recordLoginAttempt(email, ip, isValid && !!user?.isActive);

  if (!user || !isValid || !user.isActive) {
    return { error: GENERIC_ERROR };
  }

  if (!user.emailVerified) {
    // Credentials were correct — this already counted as a successful attempt above,
    // so an unverified-but-legitimate user can't get throttled out of their own
    // account by the login lockout (CLAUDE.md rule: never penalize a correct
    // password). Redirect rather than erroring so they land somewhere useful.
    redirect(`/verify-email?email=${encodeURIComponent(user.email)}&from=login`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, ip, headersList.get("user-agent"));
  await writeAuditLog({ actor: user, action: "auth.login", entity: "User", entityId: user.id, ip });

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  const next = safeNextPath(formData.get("next"));
  redirect(next ?? (user.role === "ADMIN" ? "/admin" : "/portal"));
}
