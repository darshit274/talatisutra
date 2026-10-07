import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { NewCategoryForm } from "./new-category-form";
import { CategoryRow } from "./category-row";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { materials: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Used to group materials in the materials library.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <NewCategoryForm />
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No categories yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={{
                id: category.id,
                name: category.name,
                materialCount: category._count.materials,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
