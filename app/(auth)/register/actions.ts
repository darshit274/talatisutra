"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
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

  let user;
  try {
    user = await prisma.user.create({
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this email already exists." };
    }
    throw error;
  }

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
