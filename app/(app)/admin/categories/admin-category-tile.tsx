import Link from "next/link";
import { Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { CategoryFormDialog } from "./category-form-dialog";

/**
 * The admin-only category tile: unlike the shared `components/category-tile.tsx`
 * (used read-only by the employee portal), this one carries explicit edit and view
 * actions instead of making the whole card a single click target, so the two
 * actions are distinguishable from a glance.
 */
export function AdminCategoryTile({
  id,
  name,
  description,
  materialCount,
  childCount,
  href,
}: {
  id: string;
  name: string;
  description: string | null;
  materialCount: number;
  childCount: number;
  href: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="truncate font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        {childCount} sub-categor{childCount === 1 ? "y" : "ies"} · {materialCount} material
        {materialCount === 1 ? "" : "s"}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <CategoryFormDialog mode="edit" id={id} name={name} description={description} />
        <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Eye className="size-4" aria-hidden="true" />
          View
        </Link>
      </div>
    </div>
  );
}
