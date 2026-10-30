import type { Metadata } from "next";
import Link from "next/link";
import { MATERIAL_KIND_ICON } from "@/lib/materials/kind-icon";
import { requireUser } from "@/lib/auth/session";
import { getPortalSummary } from "@/lib/queries/materials";

export const metadata: Metadata = {
  title: "Portal",
};

export default async function PortalPage() {
  const user = await requireUser("/portal");
  const { recent, categoryCounts } = await getPortalSummary(user);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Browse the materials library below, or jump straight to the full list.
        </p>
      </div>

      {categoryCounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {categoryCounts.map((category) => (
            <Link
              key={category.id}
              href={`/portal/materials/category/${category.id}`}
              className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <p className="font-medium">{category.name}</p>
              <p className="text-sm text-muted-foreground">
                {category.count} item{category.count === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recently added</h2>
          <Link
            href="/portal/materials"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="mt-4 rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No materials have been added yet.
          </div>
        ) : (
          <div className="mt-4 divide-y rounded-lg border">
            {recent.map((material) => (
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
      </div>
    </div>
  );
}
