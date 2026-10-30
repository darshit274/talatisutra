import type { Metadata } from "next";
import Link from "next/link";
import { getPageBlocks } from "@/lib/queries/content";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { BlockRenderer } from "@/components/content/block-renderer";
import { Badge } from "@/components/ui/badge";
import { resolveIcon } from "@/lib/articles/icons";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: true, follow: true },
};

export default async function ServicesPage() {
  const [blocks, categories] = await Promise.all([getPageBlocks("SERVICES"), getArticleCategories()]);
  return (
    <>
      <BlockRenderer blocks={blocks} />

      {categories.length > 0 ? (
        <div className="mx-auto max-w-3xl divide-y px-4 pb-16">
          {categories.map((category, i) => {
            const Icon = resolveIcon(category.icon);
            const tags = category.tags as string[];
            return (
              <div key={category.id} className="flex gap-6 py-8">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    <h2 className="font-heading text-xl font-medium">{category.name}</h2>
                  </div>
                  <p className="mt-2 text-muted-foreground">{category.servicesDescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="accent-outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Link
                    href={`/articles?category=${category.slug}`}
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Open {category.name} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
