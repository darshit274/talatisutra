"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, destroySession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/ip";
import { writeAuditLog } from "@/lib/audit";

export async function logout(): Promise<void> {
  const user = await getCurrentUser();

  if (user) {
    await writeAuditLog({
      actor: user,
      action: "auth.logout",
      entity: "User",
      entityId: user.id,
      ip: getClientIp(await headers()),
    });
  }

  await destroySession();
  redirect("/login");
}
