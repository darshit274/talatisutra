import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { CategoryFormDialog } from "./category-form-dialog";
import { deleteCategory } from "./actions";

export function CategoryHeaderActions({
  category,
  canDelete,
}: {
  category: { id: string; name: string; description: string | null };
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{category.name}</h1>
          <CategoryFormDialog
            mode="edit"
            id={category.id}
            name={category.name}
            description={category.description}
          />
        </div>
        {category.description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{category.description}</p>
        ) : null}
      </div>

      <DeleteConfirmButton
        action={deleteCategory.bind(null, category.id)}
        title={`Delete "${category.name}"?`}
        description="This category has no sub-categories or materials in it."
        disabled={!canDelete}
        disabledReason={
          canDelete ? undefined : "Delete the sub-categories and materials in this category first."
        }
        emphasized
      />
    </div>
  );
}
