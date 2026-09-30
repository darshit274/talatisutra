"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUserForPasswordChange } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/ip";
import { changePasswordSchema } from "@/lib/validation/auth";
import { writeAuditLog } from "@/lib/audit";

export interface ChangePasswordState {
  error?: string;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUserForPasswordChange();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password requirements." };
  }

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const isCurrentValid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);

  if (!isCurrentValid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await writeAuditLog({
    actor: user,
    action: "auth.change_password",
    entity: "User",
    entityId: user.id,
    ip: getClientIp(await headers()),
  });

  redirect(dbUser.role === "ADMIN" ? "/admin" : "/portal");
}
