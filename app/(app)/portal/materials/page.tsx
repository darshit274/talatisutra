import type { Metadata } from "next";
import Link from "next/link";
import { MATERIAL_KIND_ICON } from "@/lib/materials/kind-icon";
import { requireUser } from "@/lib/auth/session";
import { listVisibleMaterials } from "@/lib/queries/materials";
import { prisma } from "@/lib/db/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MaterialsFilterBar } from "@/components/materials-filter-bar";

export const metadata: Metadata = {
  title: "Materials",
};

interface MaterialsSearchParams {
  category?: string;
  kind?: string;
  q?: string;
  page?: string;
}

function buildMaterialsUrl(params: MaterialsSearchParams): string {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.kind) sp.set("kind", params.kind);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page !== "1") sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/portal/materials?${qs}` : "/portal/materials";
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<MaterialsSearchParams>;
}) {
  const user = await requireUser("/portal/materials");
  const params = await searchParams;

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const selectedCategory = params.category
    ? categories.find((c) => c.slug === params.category)
    : undefined;
  const kind =
    params.kind === "PDF" || params.kind === "IMAGE" || params.kind === "DOCUMENT"
      ? params.kind
      : undefined;
  const requestedPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { items, total, pageCount } = await listVisibleMaterials(user, {
    categoryId: selectedCategory?.id,
    kind,
    search: params.q,
    page,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Materials</h1>
        <p className="text-sm text-muted-foreground">
          {total} item{total === 1 ? "" : "s"}
        </p>
      </div>

      <MaterialsFilterBar
        categories={categories}
        selectedCategorySlug={params.category}
        selectedKind={kind}
        search={params.q}
      />

      {items.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No materials match your filters.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((material) => (
            <Link
              key={material.id}
              href={`/portal/materials/${material.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50"
            >
              {(() => {
                const Icon = MATERIAL_KIND_ICON[material.kind];
                return <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
              })()}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{material.title}</p>
                <p className="text-sm text-muted-foreground">
                  {material.category?.name ?? "Uncategorised"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildMaterialsUrl({ ...params, page: String(p) })}
              aria-current={p === page ? "page" : undefined}
              className={cn(buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }))}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
