"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmployeeFormState } from "./actions";

interface EmployeeFormValues {
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  departmentId: string;
  designation: string;
  phone: string;
  employeeCode: string;
}

export function EmployeeForm({
  action,
  departments,
  initialValues,
  submitLabel,
}: {
  action: (prevState: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;
  departments: Array<{ id: string; name: string }>;
  initialValues?: Partial<EmployeeFormValues>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={initialValues?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initialValues?.email} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department-trigger">Department</Label>
          <Select name="departmentId" defaultValue={initialValues?.departmentId ?? ""}>
            <SelectTrigger id="department-trigger" className="w-full">
              <SelectValue placeholder="No department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No department</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-trigger">Role</Label>
          <Select name="role" defaultValue={initialValues?.role ?? "EMPLOYEE"}>
            <SelectTrigger id="role-trigger" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">User</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input id="designation" name="designation" defaultValue={initialValues?.designation} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={initialValues?.phone} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employeeCode">User code (optional)</Label>
        <Input id="employeeCode" name="employeeCode" defaultValue={initialValues?.employeeCode} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
