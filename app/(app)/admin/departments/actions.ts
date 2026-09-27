"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { slugify } from "@/lib/slugify";
import { departmentSchema } from "@/lib/validation/departments";

export interface DepartmentFormState {
  error?: string;
}

export async function createDepartment(
  _prevState: DepartmentFormState,
  formData: FormData,
): Promise<DepartmentFormState> {
  const admin = await requireAdmin("/admin/departments");
  const parsed = departmentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  }

  const existing = await prisma.department.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "A department with this name already exists." };
  }

  const department = await prisma.department.create({
    data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
  });

  await writeAuditLog({
    actor: admin,
    action: "department.create",
    entity: "Department",
    entityId: department.id,
    meta: { name: department.name },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/departments");
  return {};
}

export async function updateDepartment(
  id: string,
  _prevState: DepartmentFormState,
  formData: FormData,
): Promise<DepartmentFormState> {
  const admin = await requireAdmin("/admin/departments");
  const parsed = departmentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  }

  const existing = await prisma.department.findUnique({ where: { name: parsed.data.name } });
  if (existing && existing.id !== id) {
    return { error: "A department with this name already exists." };
  }

  await prisma.department.update({
    where: { id },
    data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
  });

  await writeAuditLog({
    actor: admin,
    action: "department.update",
    entity: "Department",
    entityId: id,
    meta: { name: parsed.data.name },
    ip: getClientIp(await headers()),
  });

  revalidatePath("/admin/departments");
  return {};
}

export async function deleteDepartment(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/departments");
  const department = await prisma.department.findUnique({ where: { id } });

  if (department) {
    // User.departmentId is SetNull and MaterialDepartment is Cascade (removes only the
    // join row, not the Material) — deleting a department doesn't delete employees or
    // materials, it just unassigns them. The confirm dialog names the counts anyway
    // (BUILD-PLAN §6) so this isn't a silent surprise.
    await prisma.department.delete({ where: { id } });

    await writeAuditLog({
      actor: admin,
      action: "department.delete",
      entity: "Department",
      entityId: id,
      meta: { name: department.name },
      ip: getClientIp(await headers()),
    });
  }

  redirect("/admin/departments");
}
