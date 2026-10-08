import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCategoryRoot } from "@/lib/queries/categories";
import { prisma } from "@/lib/db/prisma";
import { NewCategoryForm } from "./new-category-form";
import { CategoryUploadForm } from "./category-upload-form";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const [{ topLevel, uncategorised }, departments] = await Promise.all([
    getAdminCategoryRoot(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Click into a category to rename it, add sub-categories, or upload materials
          directly into it.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <NewCategoryForm parentId={null} />
      </div>

      {topLevel.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {topLevel.map((category) => (
            <CategoryTile
              key={category.id}
              href={`/admin/categories/${category.id}`}
              name={category.name}
              materialCount={category.materialCount}
              childCount={category.childCount}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Uncategorised materials</h2>
        {uncategorised.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every material has a category.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {uncategorised.map((material) => (
              <MaterialRow
                key={material.id}
                href={`/admin/materials/${material.id}`}
                material={material}
              />
            ))}
          </div>
        )}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Upload an uncategorised material</h3>
          <CategoryUploadForm categoryId={null} departments={departments} />
        </div>
      </div>
    </div>
  );
}
