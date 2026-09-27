import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { EmployeeForm } from "../employee-form";
import { createEmployee } from "../actions";

export const metadata: Metadata = {
  title: "New employee",
};

export default async function NewEmployeePage() {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New employee</h1>
        <p className="text-sm text-muted-foreground">
          A temporary password is generated and emailed to them — they&apos;ll be asked
          to set their own on first login.
        </p>
      </div>

      <EmployeeForm action={createEmployee} departments={departments} submitLabel="Create employee" />
    </div>
  );
}
