import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { NewDepartmentForm } from "./new-department-form";
import { DepartmentRow } from "./department-row";

export const metadata: Metadata = {
  title: "Departments",
};

export default async function AdminDepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, materials: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Users belong to a department; materials can be restricted to one or more.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <NewDepartmentForm />
      </div>

      {departments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No departments yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          {departments.map((department) => (
            <DepartmentRow
              key={department.id}
              department={{
                id: department.id,
                name: department.name,
                userCount: department._count.users,
                materialCount: department._count.materials,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
