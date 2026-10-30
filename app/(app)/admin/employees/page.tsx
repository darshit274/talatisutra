import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Users",
};

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", EMPLOYEE: "User" };

export default async function AdminEmployeesPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { department: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/employees/new" className={cn(buttonVariants())}>
          New user
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No users yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((employeeRow) => (
                <TableRow key={employeeRow.id}>
                  <TableCell>
                    <Link
                      href={`/admin/employees/${employeeRow.id}`}
                      className="font-medium hover:underline"
                    >
                      {employeeRow.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{employeeRow.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {employeeRow.department?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {employeeRow.designation ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employeeRow.role === "ADMIN" ? "default" : "outline"}>
                      {ROLE_LABELS[employeeRow.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employeeRow.isActive ? "default" : "destructive"}>
                      {employeeRow.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {employeeRow.lastLoginAt ? format(employeeRow.lastLoginAt, "d MMM yyyy") : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
