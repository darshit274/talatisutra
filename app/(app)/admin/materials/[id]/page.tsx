import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { formatBytes } from "@/lib/format";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { EditMaterialForm } from "./edit-material-form";
import { ReplaceFileForm } from "./replace-file-form";
import { MaterialPreview } from "./material-preview";
import { deleteMaterial } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const material = await prisma.material.findUnique({ where: { id } });
  return { title: material?.title ?? "Material" };
}

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin("/admin/materials");

  const [material, categories, departments] = await Promise.all([
    prisma.material.findUnique({ where: { id }, include: { departments: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!material) {
    notFound();
  }

  const fileUrl = `/api/materials/${material.id}/file`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{material.title}</h1>
          <p className="text-sm text-muted-foreground">
            {material.kind} · {formatBytes(material.sizeBytes)} · {material.originalName}
          </p>
        </div>
        <a href={`${fileUrl}?download=1`} className={cn(buttonVariants({ variant: "outline" }))}>
          <Download className="size-4" aria-hidden="true" />
          Download
        </a>
      </div>

      {/* Confirms what was actually uploaded right after an upload or replace —
          the edit form below only ever touches metadata, never the file itself. */}
      <MaterialPreview fileUrl={fileUrl} kind={material.kind} title={material.title} />

      <div className="max-w-xl space-y-8">
        {/* Keyed on updatedAt so a successful save remounts the form with fresh
            defaultValues, instead of mutating an already-initialized uncontrolled
            Base UI input in place (which it warns about). */}
        <EditMaterialForm
          key={material.updatedAt.toISOString()}
          materialId={id}
          categories={categories}
          departments={departments}
          initialValues={{
            title: material.title,
            description: material.description ?? "",
            categoryId: material.categoryId ?? "",
            visibility: material.visibility,
            departmentIds: material.departments.map((d) => d.departmentId),
          }}
        />

        <Separator />

        <div className="space-y-2">
          <h2 className="text-sm font-medium">Replace file</h2>
          <p className="text-sm text-muted-foreground">
            Keeps the same title, description and visibility — only the file changes.
          </p>
          <ReplaceFileForm materialId={id} />
        </div>

        <Separator />

        <DeleteConfirmButton
          action={deleteMaterial.bind(null, id)}
          title={`Delete "${material.title}"?`}
          description="This permanently deletes the material and its file. Users will no longer be able to see or download it."
        />
      </div>
    </div>
  );
}
