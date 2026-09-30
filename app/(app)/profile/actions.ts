"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/ip";
import { writeAuditLog } from "@/lib/audit";
import { updateProfileSchema } from "@/lib/validation/profile";

export interface ProfileFormState {
  error?: string;
  success?: boolean;
}

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser("/profile");

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    designation: formData.get("designation"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form fields." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      designation: parsed.data.designation || null,
      phone: parsed.data.phone || null,
    },
  });

  await writeAuditLog({
    actor: user,
    action: "profile.update",
    entity: "User",
    entityId: user.id,
    ip: getClientIp(await headers()),
  });

  revalidatePath("/profile");
  // The header/sidebar (AppShell) render the session-derived name, not this row, so a
  // name change needs the whole shell to re-render too.
  revalidatePath("/", "layout");

  return { success: true };
}
