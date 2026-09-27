"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { slugify } from "@/lib/slugify";
import { categorySchema } from "@/lib/validation/categories";

export interface CategoryFormState {
  error?: string;
}

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const admin = await requireAdmin("/admin/categories");
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  }

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A category with this name already exists." };
  }

  const count = await prisma.category.count();
  const category = await prisma.category.create({
    data: { name: parsed.data.name, slug: slugify(parsed.data.name), sortOrder: count },
  });

  await writeAuditLog({
    actor: admin,
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    meta: { name: category.name },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/categories");
  return {};
}

export async function updateCategory(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const admin = await requireAdmin("/admin/categories");
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  }

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (existing && existing.id !== id) {
    return { error: "A category with this name already exists." };
  }

  await prisma.category.update({
    where: { id },
    data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
  });

  await writeAuditLog({
    actor: admin,
    action: "category.update",
    entity: "Category",
    entityId: id,
    meta: { name: parsed.data.name },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/categories");
  return {};
}

export async function deleteCategory(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/categories");
  const category = await prisma.category.findUnique({ where: { id } });

  if (category) {
    // Material.categoryId is SetNull on delete — materials aren't removed, they just
    // lose this category.
    await prisma.category.delete({ where: { id } });

    await writeAuditLog({
      actor: admin,
      action: "category.delete",
      entity: "Category",
      entityId: id,
      meta: { name: category.name },
      ip: getClientIp(await headers()),
    });
  }

  redirect("/admin/categories");
}
