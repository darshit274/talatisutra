import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Download, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getVisibleMaterialById } from "@/lib/queries/materials";
import { formatBytes } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/${id}`);
  const material = await getVisibleMaterialById(user, id);
  return { title: material?.title ?? "Material" };
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/portal/materials/${id}`);
  const material = await getVisibleMaterialById(user, id);

  // Same 404 whether the id doesn't exist or just isn't visible to this user
  // (BUILD-PLAN §7) — never confirm existence to someone who can't see it.
  if (!material) {
    notFound();
  }

  const fileUrl = `/api/materials/${material.id}/file`;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/materials"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to materials
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{material.title}</h1>
          <p className="text-sm text-muted-foreground">
            {material.category?.name ?? "Uncategorised"} · {formatBytes(material.sizeBytes)} ·{" "}
            Added {format(material.createdAt, "d MMM yyyy")}
          </p>
        </div>
        <a href={`${fileUrl}?download=1`} className={cn(buttonVariants({ variant: "outline" }))}>
          <Download className="size-4" aria-hidden="true" />
          Download
        </a>
      </div>

      {material.description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{material.description}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        {material.kind === "PDF" ? (
          <iframe src={fileUrl} title={material.title} className="h-[80vh] w-full" />
        ) : material.kind === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element -- served through our own auth-checked route, not a static asset next/image can optimize
          <img src={fileUrl} alt={material.title} className="mx-auto max-h-[80vh] w-full object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No preview available for this file type — use Download above to view it.
          </div>
        )}
      </div>
    </div>
  );
}
