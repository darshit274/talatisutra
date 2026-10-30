"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";

export async function markEnquiryRead(id: string, isRead: boolean): Promise<void> {
  await requireAdmin("/admin/enquiries");
  await prisma.contactEnquiry.update({ where: { id }, data: { isRead } });
  revalidatePath("/admin/enquiries");
}
