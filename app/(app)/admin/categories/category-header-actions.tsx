"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { updateCategory, deleteCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

export function CategoryHeaderActions({
  category,
  canDelete,
}: {
  category: { id: string; name: string };
  canDelete: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateCategory.bind(null, category.id),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
        {/* Keyed on name so a successful rename remounts this uncontrolled input with
            the new defaultValue, instead of mutating it in place post-revalidation. */}
        <Input key={category.name} name="name" defaultValue={category.name} className="max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      <DeleteConfirmButton
        action={deleteCategory.bind(null, category.id)}
        title={`Delete "${category.name}"?`}
        description="This category has no sub-categories or materials in it."
        disabled={!canDelete}
        disabledReason={
          canDelete ? undefined : "Delete the sub-categories and materials in this category first."
        }
      />
    </div>
  );
}
