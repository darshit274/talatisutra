import { prisma } from "@/lib/db/prisma";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

/** BUILD-PLAN §4: reject login when 5+ failures for the same email OR the same IP. */
export async function isLoginThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "LOGIN", success: false, email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "LOGIN", success: false, ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success, kind: "LOGIN" } });
}

/**
 * Same 5-per-15-minutes window applied to /forgot-password (BUILD-PLAN §4 fix #6), so
 * the endpoint can't be used to flood an inbox or hammer SMTP. Every submission counts
 * (there's no success/failure distinction here — we always return the same generic
 * message), which is why this reuses the `kind` discriminator rather than `success`.
 */
export async function isPasswordResetThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "PASSWORD_RESET", email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "PASSWORD_RESET", ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordPasswordResetRequest(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success: true, kind: "PASSWORD_RESET" } });
}
