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
  parentId: string | null,
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

  const count = await prisma.category.count({ where: { parentId } });
  const category = await prisma.category.create({
    data: { name: parsed.data.name, slug: slugify(parsed.data.name), sortOrder: count, parentId },
  });

  await writeAuditLog({
    actor: admin,
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    meta: { name: category.name, parentId: category.parentId },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/categories");
  if (parentId) revalidatePath(`/admin/categories/${parentId}`);
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
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, materials: true } } },
  });

  if (!category) {
    redirect("/admin/categories");
  }

  if (category._count.children > 0 || category._count.materials > 0) {
    redirect(`/admin/categories/${id}?error=has-children`);
  }

  await prisma.category.delete({ where: { id } });

  await writeAuditLog({
    actor: admin,
    action: "category.delete",
    entity: "Category",
    entityId: id,
    meta: { name: category.name },
    ip: getClientIp(await headers()),
  });

  redirect(category.parentId ? `/admin/categories/${category.parentId}` : "/admin/categories");
}
