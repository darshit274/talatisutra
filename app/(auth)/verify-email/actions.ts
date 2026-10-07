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
