"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
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
  const [isRenaming, setIsRenaming] = useState(false);

  // Close the rename form only on a genuine pending->not-pending transition
  // with no error (i.e. right after a real submit succeeds) — checking
  // `!pending && !state.error` alone would also fire the instant the form
  // opens, since that's the initial, pre-submit state too.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setIsRenaming(false);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isRenaming ? (
        <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
          {/* Keyed on name so a successful rename remounts this uncontrolled input with
              the new defaultValue, instead of mutating it in place post-revalidation. */}
          <Input
            key={category.name}
            name="name"
            defaultValue={category.name}
            className="max-w-xs"
            autoFocus
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsRenaming(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </form>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <h1 className="text-xl font-semibold">{category.name}</h1>
          <Button variant="ghost" size="sm" onClick={() => setIsRenaming(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Rename
          </Button>
        </div>
      )}

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
