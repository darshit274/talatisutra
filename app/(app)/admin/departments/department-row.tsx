"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { updateDepartment, deleteDepartment, type DepartmentFormState } from "./actions";

const initialState: DepartmentFormState = {};

export function DepartmentRow({
  department,
}: {
  department: { id: string; name: string; userCount: number; materialCount: number };
}) {
  const [state, formAction, pending] = useActionState(
    updateDepartment.bind(null, department.id),
    initialState,
  );

  const parts: string[] = [];
  if (department.userCount > 0) {
    parts.push(`${department.userCount} user${department.userCount === 1 ? "" : "s"}`);
  }
  if (department.materialCount > 0) {
    parts.push(`${department.materialCount} material${department.materialCount === 1 ? "" : "s"}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
      <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
        {/* Keyed on name so a successful rename remounts this uncontrolled input with
            the new defaultValue, instead of mutating it in place post-revalidation
            (Base UI's Input warns on that). */}
        <Input key={department.name} name="name" defaultValue={department.name} className="max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      <span className="text-sm text-muted-foreground">
        {parts.length > 0 ? parts.join(" · ") : "Unused"}
      </span>

      <DeleteConfirmButton
        action={deleteDepartment.bind(null, department.id)}
        title={`Delete "${department.name}"?`}
        description={
          parts.length > 0
            ? `${parts.join(" and ")} will be unassigned from this department — they are not deleted.`
            : "No users or materials are assigned to this department."
        }
      />
    </div>
  );
}
