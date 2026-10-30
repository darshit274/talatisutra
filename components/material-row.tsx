import Link from "next/link";
import type { MaterialKind } from "@prisma/client";
import { MATERIAL_KIND_ICON } from "@/lib/materials/kind-icon";

export function MaterialRow({
  href,
  material,
}: {
  href: string;
  material: { title: string; kind: MaterialKind };
}) {
  const Icon = MATERIAL_KIND_ICON[material.kind];
  return (
    <Link href={href} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">{material.title}</span>
    </Link>
  );
}
