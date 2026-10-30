"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { generateToken } from "@/lib/auth/tokens";
import { getClientIp } from "@/lib/auth/ip";
import { isPasswordResetThrottled, recordPasswordResetRequest } from "@/lib/auth/throttle";
import { sendPasswordResetEmail } from "@/lib/mail";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export interface ForgotPasswordState {
  submitted: boolean;
  error?: string;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const THROTTLED_ERROR = "Too many requests. Try again in a few minutes.";

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { submitted: false, error: "Enter a valid email address." };
  }

  const { email } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isPasswordResetThrottled(email, ip)) {
    return { submitted: false, error: THROTTLED_ERROR };
  }

  await recordPasswordResetRequest(email, ip);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.isActive) {
    const { token, tokenHash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    await sendPasswordResetEmail(user.email, `${env.APP_URL}/reset-password/${token}`);
  }

  // Same response whether or not the account exists (BUILD-PLAN §4) — never reveal which.
  return { submitted: true };
}
