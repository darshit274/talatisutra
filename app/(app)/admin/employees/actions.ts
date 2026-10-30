"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { sendNewAccountEmail } from "@/lib/mail";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { employeeSchema, setPasswordSchema } from "@/lib/validation/employees";

export interface EmployeeFormState {
  error?: string;
}

function parseEmployeeFormData(formData: FormData) {
  return employeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
    phone: formData.get("phone"),
    employeeCode: formData.get("employeeCode"),
  });
}

export async function createEmployee(
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const admin = await requireAdmin("/admin/employees/new");
  const parsed = parseEmployeeFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const employee = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId || null,
      designation: parsed.data.designation || null,
      phone: parsed.data.phone || null,
      employeeCode: parsed.data.employeeCode || null,
      passwordHash,
      mustChangePassword: true,
    },
  });

  await sendNewAccountEmail(employee.email, tempPassword);

  await writeAuditLog({
    actor: admin,
    action: "employee.create",
    entity: "User",
    entityId: employee.id,
    meta: { name: employee.name, email: employee.email, role: employee.role },
    ip: getClientIp(await headers()),
  });

  redirect(`/admin/employees/${employee.id}`);
}

export async function updateEmployee(
  id: string,
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const admin = await requireAdmin("/admin/employees");
  const parsed = parseEmployeeFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing && existing.id !== id) {
    return { error: "An account with this email already exists." };
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId || null,
      designation: parsed.data.designation || null,
      phone: parsed.data.phone || null,
      employeeCode: parsed.data.employeeCode || null,
    },
  });

  await writeAuditLog({
    actor: admin,
    action: "employee.update",
    entity: "User",
    entityId: id,
    meta: { name: parsed.data.name, email: parsed.data.email },
    ip: getClientIp(await headers()),
  });

  revalidatePath(`/admin/employees/${id}`);
  revalidatePath("/admin/employees");
  return {};
}

export interface SetPasswordFormState {
  error?: string;
  success?: boolean;
}

export async function setEmployeePassword(
  id: string,
  _prevState: SetPasswordFormState,
  formData: FormData,
): Promise<SetPasswordFormState> {
  const admin = await requireAdmin("/admin/employees");
  const parsed = setPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password requirements." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  // Not explicitly required by BUILD-PLAN §4 for this flow (only the self-service
  // reset-password link explicitly kills sessions), but a sensible default: if an
  // admin is setting someone's password directly, treat it the same way.
  await destroyAllSessionsForUser(id);

  await writeAuditLog({
    actor: admin,
    action: "employee.set_password",
    entity: "User",
    entityId: id,
    ip: getClientIp(await headers()),
  });

  revalidatePath(`/admin/employees/${id}`);
  return { success: true };
}

export async function deactivateEmployee(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/employees");
  if (id === admin.id) {
    throw new Error("You can't deactivate your own account.");
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  // CLAUDE.md rule 7 — revoke access immediately, not at token expiry.
  await destroyAllSessionsForUser(id);

  await writeAuditLog({
    actor: admin,
    action: "employee.deactivate",
    entity: "User",
    entityId: id,
    ip: getClientIp(await headers()),
  });

  revalidatePath(`/admin/employees/${id}`);
  revalidatePath("/admin/employees");
}

export async function reactivateEmployee(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/employees");
  await prisma.user.update({ where: { id }, data: { isActive: true } });

  await writeAuditLog({
    actor: admin,
    action: "employee.reactivate",
    entity: "User",
    entityId: id,
    ip: getClientIp(await headers()),
  });

  revalidatePath(`/admin/employees/${id}`);
  revalidatePath("/admin/employees");
}

export async function deleteEmployee(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/employees");
  if (id === admin.id) {
    throw new Error("You can't delete your own account.");
  }

  const employee = await prisma.user.findUnique({ where: { id } });

  if (employee) {
    // Sessions and password-reset tokens cascade (schema onDelete: Cascade);
    // Material.uploadedById is SetNull, so their uploads survive with no attribution.
    await prisma.user.delete({ where: { id } });

    await writeAuditLog({
      actor: admin,
      action: "employee.delete",
      entity: "User",
      entityId: id,
      meta: { name: employee.name, email: employee.email },
      ip: getClientIp(await headers()),
    });
  }

  redirect("/admin/employees");
}
