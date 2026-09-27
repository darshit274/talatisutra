import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { listMaterialsForAdmin } from "@/lib/queries/admin";
import { MaterialsFilterBar } from "@/components/materials-filter-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = {
  title: "Materials",
};

interface MaterialsSearchParams {
  category?: string;
  kind?: string;
  q?: string;
  page?: string;
}

function buildAdminMaterialsUrl(params: MaterialsSearchParams): string {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.kind) sp.set("kind", params.kind);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page !== "1") sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/admin/materials?${qs}` : "/admin/materials";
}

export default async function AdminMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<MaterialsSearchParams>;
}) {
  const params = await searchParams;
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const selectedCategory = params.category
    ? categories.find((c) => c.slug === params.category)
    : undefined;
  const kind = params.kind === "PDF" || params.kind === "IMAGE" ? params.kind : undefined;
  const requestedPage = params.page ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { items, total, pageCount } = await listMaterialsForAdmin({
    categoryId: selectedCategory?.id,
    kind,
    search: params.q,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Materials</h1>
          <p className="text-sm text-muted-foreground">
            {total} item{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/materials/new" className={cn(buttonVariants())}>
          Upload material
        </Link>
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
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Uploaded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    <Link
                      href={`/admin/materials/${material.id}`}
                      className="font-medium hover:underline"
                    >
                      {material.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {material.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{material.kind}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatBytes(material.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    {material.visibility === "ALL" ? (
                      <Badge variant="outline">All</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {material.departments.length} department
                        {material.departments.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {material.uploadedBy?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildAdminMaterialsUrl({ ...params, page: String(p) })}
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
