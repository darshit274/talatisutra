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

/**
 * Same 5-per-15-minutes window applied to /contact (BUILD-PLAN §4 fix #6), so the
 * public contact form can't be used to flood an inbox or hammer SMTP. As with
 * /forgot-password, every submission counts — there's no success/failure distinction.
 */
export async function isContactFormThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "CONTACT_FORM", email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "CONTACT_FORM", ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordContactFormSubmission(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success: true, kind: "CONTACT_FORM" } });
}

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

/**
 * Same window applied to the public newsletter signup, so it can't be scripted to
 * flood the subscriber list with arbitrary addresses (review finding I-7).
 */
export async function isNewsletterSubscribeThrottled(email: string, ip: string): Promise<boolean> {
  const since = windowStart();
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { kind: "NEWSLETTER_SUBSCRIBE", email, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { kind: "NEWSLETTER_SUBSCRIBE", ip, createdAt: { gte: since } },
    }),
  ]);
  return byEmail >= MAX_ATTEMPTS || byIp >= MAX_ATTEMPTS;
}

export async function recordNewsletterSubscribeAttempt(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success: true, kind: "NEWSLETTER_SUBSCRIBE" } });
}
