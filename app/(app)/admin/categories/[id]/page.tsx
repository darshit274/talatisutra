import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCategoryPage } from "@/lib/queries/categories";
import { prisma } from "@/lib/db/prisma";
import { CategoryFormDialog } from "@/app/(app)/admin/categories/category-form-dialog";
import { CategoryUploadForm } from "@/app/(app)/admin/categories/category-upload-form";
import { CategoryHeaderActions } from "@/app/(app)/admin/categories/category-header-actions";
import { AdminCategoryTile } from "@/app/(app)/admin/categories/admin-category-tile";
import { MaterialRow } from "@/components/material-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await requireAdmin("/admin/categories");
  const { id } = await params;
  const data = await getAdminCategoryPage(id);
  return { title: data?.category.name ?? "Category" };
}

export default async function AdminCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin("/admin/categories");
  const { id } = await params;
  const { error } = await searchParams;

  const [data, departments] = await Promise.all([
    getAdminCategoryPage(id),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!data) {
    notFound();
  }

  const { category, breadcrumbs, children, materials } = data;
  const canDelete = children.length === 0 && materials.length === 0;

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin/categories" className="hover:text-foreground">
          Categories
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {crumb.id === id ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={`/admin/categories/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {error === "has-children" ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {`Delete the ${children.length} sub-categor${children.length === 1 ? "y" : "ies"} and ${materials.length} material${materials.length === 1 ? "" : "s"} in this category first.`}
        </p>
      ) : null}

      <CategoryHeaderActions category={category} canDelete={canDelete} />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Sub-categories</h2>
        {children.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {children.map((child) => (
              <AdminCategoryTile
                key={child.id}
                id={child.id}
                href={`/admin/categories/${child.id}`}
                name={child.name}
                description={child.description}
                materialCount={child.materialCount}
                childCount={child.childCount}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sub-categories yet.</p>
        )}
        <CategoryFormDialog mode="create" parentId={category.id} triggerLabel="New sub-category" />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Materials in this category</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials in this category yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {materials.map((material) => (
              <MaterialRow
                key={material.id}
                href={`/admin/materials/${material.id}`}
                material={material}
              />
            ))}
          </div>
        )}
        <CategoryUploadForm
          categoryId={category.id}
          departments={departments}
          triggerLabel="Upload a material into this category"
        />
      </div>
    </div>
  );
}
