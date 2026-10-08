import Link from "next/link";

export function CategoryTile({
  href,
  name,
  materialCount,
  childCount,
}: {
  href: string;
  name: string;
  materialCount: number;
  childCount: number;
}) {
  return (
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        {childCount} sub-categor{childCount === 1 ? "y" : "ies"} · {materialCount} material
        {materialCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
