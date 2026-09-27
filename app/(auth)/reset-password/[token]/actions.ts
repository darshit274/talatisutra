"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { resetPasswordSchema } from "@/lib/validation/auth";

export interface ResetPasswordState {
  error?: string;
}

const INVALID_TOKEN_ERROR = "This reset link is invalid or has expired.";

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) {
    return { error: INVALID_TOKEN_ERROR };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password requirements." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
    return { error: INVALID_TOKEN_ERROR };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Using the link kills every existing session for the account (BUILD-PLAN §4).
  await destroyAllSessionsForUser(resetToken.userId);

  redirect("/login?reset=success");
}
