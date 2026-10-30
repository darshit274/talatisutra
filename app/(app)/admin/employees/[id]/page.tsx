import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { EmployeeForm } from "../employee-form";
import { SetPasswordForm } from "./set-password-form";
import { updateEmployee, deactivateEmployee, reactivateEmployee, deleteEmployee } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await prisma.user.findUnique({ where: { id } });
  return { title: employee?.name ?? "User" };
}

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin("/admin/employees");

  const [employee, departments, uploadedCount] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.material.count({ where: { uploadedById: id } }),
  ]);

  if (!employee) {
    notFound();
  }

  const isSelf = employee.id === admin.id;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{employee.name}</h1>
        <p className="text-sm text-muted-foreground">{employee.email}</p>
      </div>

      {/* Keyed on updatedAt so a successful save remounts the form with fresh
          defaultValues instead of mutating an already-initialized uncontrolled
          Base UI input in place (which it warns about). */}
      <EmployeeForm
        key={employee.updatedAt.toISOString()}
        action={updateEmployee.bind(null, id)}
        departments={departments}
        initialValues={{
          name: employee.name,
          email: employee.email,
          role: employee.role,
          departmentId: employee.departmentId ?? "",
          designation: employee.designation ?? "",
          phone: employee.phone ?? "",
          employeeCode: employee.employeeCode ?? "",
        }}
        submitLabel="Save changes"
      />

      <Separator />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Set password</h2>
        <p className="text-sm text-muted-foreground">
          Sets a new password directly and forces a change on next login.
        </p>
        <SetPasswordForm userId={id} />
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Account status</h2>
        {isSelf ? (
          <p className="text-sm text-muted-foreground">
            You can&apos;t deactivate or delete your own account.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <form action={employee.isActive ? deactivateEmployee.bind(null, id) : reactivateEmployee.bind(null, id)}>
              <Button type="submit" variant="outline">
                {employee.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </form>

            <DeleteConfirmButton
              action={deleteEmployee.bind(null, id)}
              title={`Delete ${employee.name}?`}
              description={
                uploadedCount > 0
                  ? `This permanently deletes their account and sessions. ${uploadedCount} material${uploadedCount === 1 ? "" : "s"} they uploaded will remain, with no uploader on record.`
                  : "This permanently deletes their account and sessions."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
