"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { deleteUploadedFile } from "@/lib/materials/upload";
import { materialMetadataSchema } from "@/lib/validation/materials";

export interface MaterialFormState {
  error?: string;
}

export async function updateMaterialMetadata(
  id: string,
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  const admin = await requireAdmin("/admin/materials");
  const parsed = materialMetadataSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    visibility: formData.get("visibility"),
    departmentIds: formData.getAll("departmentIds"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        categoryId: parsed.data.categoryId || null,
        visibility: parsed.data.visibility,
      },
    });

    await tx.materialDepartment.deleteMany({ where: { materialId: id } });
    if (parsed.data.visibility === "DEPARTMENTS" && parsed.data.departmentIds.length > 0) {
      await tx.materialDepartment.createMany({
        data: parsed.data.departmentIds.map((departmentId) => ({ materialId: id, departmentId })),
      });
    }
  });

  await writeAuditLog({
    actor: admin,
    action: "material.update",
    entity: "Material",
    entityId: id,
    meta: { title: parsed.data.title },
    ip: getClientIp(await headers()),
  });

  revalidatePath(`/admin/materials/${id}`);
  revalidatePath("/admin/materials");
  return {};
}

export async function deleteMaterial(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/materials");
  const material = await prisma.material.findUnique({ where: { id } });

  if (material) {
    // MaterialDepartment cascades. A missing file on disk is not an error
    // (BUILD-PLAN §7 delete step).
    await prisma.material.delete({ where: { id } });
    await deleteUploadedFile(material.storageKey);

    await writeAuditLog({
      actor: admin,
      action: "material.delete",
      entity: "Material",
      entityId: id,
      meta: { title: material.title },
      ip: getClientIp(await headers()),
    });
  }

  redirect("/admin/materials");
}
