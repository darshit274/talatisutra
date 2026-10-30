import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listVisibleMaterials } from "@/lib/queries/materials";
import { getVisibleCategoryRoot } from "@/lib/queries/categories";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { MaterialsFilterBar } from "@/components/materials-filter-bar";
import { CategoryTile } from "@/components/category-tile";
import { MaterialRow } from "@/components/material-row";

export const metadata: Metadata = {
  title: "Materials",
};

interface MaterialsSearchParams {
  kind?: string;
  q?: string;
  page?: string;
}

function buildMaterialsUrl(params: MaterialsSearchParams): string {
  const sp = new URLSearchParams();
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

  const kind =
    params.kind === "PDF" || params.kind === "IMAGE" || params.kind === "DOCUMENT"
      ? params.kind
      : undefined;
  const requestedPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const isBrowsing = !kind && !params.q;

  const [{ topLevel, uncategorised }, listResult] = await Promise.all([
    isBrowsing ? getVisibleCategoryRoot(user) : Promise.resolve({ topLevel: [], uncategorised: [] }),
    listVisibleMaterials(user, { kind, search: params.q, page }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Materials</h1>
        <p className="text-sm text-muted-foreground">
          Browse by category, or search across everything.
        </p>
      </div>

      <MaterialsFilterBar selectedKind={kind} search={params.q} />

      {isBrowsing ? (
        <>
          {topLevel.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {topLevel.map((category) => (
                <CategoryTile
                  key={category.id}
                  href={`/portal/materials/category/${category.id}`}
                  name={category.name}
                  materialCount={category.materialCount}
                  childCount={category.childCount}
                />
              ))}
            </div>
          ) : null}

          {uncategorised.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-medium">Uncategorised</h2>
              <div className="divide-y rounded-lg border">
                {uncategorised.map((material) => (
                  <MaterialRow
                    key={material.id}
                    href={`/portal/materials/${material.id}`}
                    material={material}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {topLevel.length === 0 && uncategorised.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No materials are available to you yet.
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {listResult.total} result{listResult.total === 1 ? "" : "s"}
          </p>
          {listResult.items.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No materials match your filters.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {listResult.items.map((material) => (
                <MaterialRow
                  key={material.id}
                  href={`/portal/materials/${material.id}`}
                  material={material}
                />
              ))}
            </div>
          )}

          {listResult.pageCount > 1 ? (
            <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
              {Array.from({ length: listResult.pageCount }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildMaterialsUrl({ ...params, page: String(p) })}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }),
                  )}
                >
                  {p}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
