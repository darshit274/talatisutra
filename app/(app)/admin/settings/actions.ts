"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { siteSettingsInputSchema } from "@/lib/validation/site-settings";

export interface SettingsFormState {
  error?: string;
}

export async function updateSiteSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const admin = await requireAdmin("/admin/settings");

  const parsed = siteSettingsInputSchema.safeParse({
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    contactHours: formData.get("contactHours"),
    contactHoursGu: formData.get("contactHoursGu"),
    contactAddress: formData.get("contactAddress"),
    contactAddressGu: formData.get("contactAddressGu"),
    aboutDisclaimer: formData.get("aboutDisclaimer"),
    aboutDisclaimerGu: formData.get("aboutDisclaimerGu"),
    aboutPhotoKey: formData.get("aboutPhotoKey") || null,
    contactMapImageKey: formData.get("contactMapImageKey") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await getSiteSettings();
  await prisma.siteSettings.update({
    where: { id: existing.id },
    data: { ...parsed.data, updatedById: admin.id },
  });

  await writeAuditLog({
    actor: admin,
    action: "site-settings.update",
    entity: "SiteSettings",
    entityId: existing.id,
    ip: getClientIp(await headers()),
  });

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/admin/settings");
  return {};
}
