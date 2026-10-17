import type { Metadata } from "next";
import Link from "next/link";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: true, follow: true },
};

export default async function ServicesPage() {
  const blocks = await getPageBlocks("SERVICES");
  return (
    <>
      <BlockRenderer blocks={blocks} />

      <div className="mx-auto max-w-3xl divide-y px-4 pb-16">
        {CATEGORY_ORDER.map((category, i) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          return (
            <div key={category} className="flex gap-6 py-8">
              <span className="text-sm tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h2 className="font-heading text-xl font-medium">{meta.label}</h2>
                </div>
                <p className="mt-2 text-muted-foreground">{meta.servicesDescription}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.tags.map((tag) => (
                    <Badge key={tag} variant="accent-outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Link
                  href={meta.path}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Open {meta.label} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
