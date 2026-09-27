"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { updateCategory, deleteCategory, type CategoryFormState } from "./actions";

const initialState: CategoryFormState = {};

export function CategoryRow({
  category,
}: {
  category: { id: string; name: string; materialCount: number };
}) {
  const [state, formAction, pending] = useActionState(
    updateCategory.bind(null, category.id),
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
      <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
        {/* Keyed on name so a successful rename remounts this uncontrolled input with
            the new defaultValue, instead of mutating it in place post-revalidation
            (Base UI's Input warns on that). */}
        <Input key={category.name} name="name" defaultValue={category.name} className="max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      <span className="text-sm text-muted-foreground">
        {category.materialCount} material{category.materialCount === 1 ? "" : "s"}
      </span>

      <DeleteConfirmButton
        action={deleteCategory.bind(null, category.id)}
        title={`Delete "${category.name}"?`}
        description={
          category.materialCount > 0
            ? `${category.materialCount} material${category.materialCount === 1 ? "" : "s"} will lose this category (they aren't deleted).`
            : "This category isn't used by any materials."
        }
      />
    </div>
  );
}
