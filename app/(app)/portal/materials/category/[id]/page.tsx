import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getVisibleCategoryPage } from "@/lib/queries/categories";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/category/${id}`);
  const data = await getVisibleCategoryPage(user, id);
  return { title: data?.category.name ?? "Category" };
}

export default async function PortalCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/category/${id}`);
  const data = await getVisibleCategoryPage(user, id);

  // Same 404 whether the category doesn't exist or has nothing visible to this user
  // anywhere in its subtree (lib/queries/categories.ts) — never confirm existence to
  // someone who can't see it (BUILD-PLAN §7).
  if (!data) {
    notFound();
  }

  const { category, breadcrumbs, children, materials } = data;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/portal/materials" className="hover:text-foreground">
          Materials
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {crumb.id === id ? (
              <span className="text-foreground">{crumb.name}</span>
            ) : (
              <Link href={`/portal/materials/category/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <h1 className="text-xl font-semibold">{category.name}</h1>

      {children.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {children.map((child) => (
            <CategoryTile
              key={child.id}
              href={`/portal/materials/category/${child.id}`}
              name={child.name}
              materialCount={child.materialCount}
              childCount={child.childCount}
            />
          ))}
        </div>
      ) : null}

      {materials.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No materials directly in this category.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {materials.map((material) => (
            <MaterialRow
              key={material.id}
              href={`/portal/materials/${material.id}`}
              material={material}
            />
          ))}
        </div>
      )}
    </div>
  );
}
