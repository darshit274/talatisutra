import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { getArticles, getArticleCategoryCounts, getLatestArticles } from "@/lib/queries/articles";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { getPageBlocks } from "@/lib/queries/content";
import type { TextBlockData } from "@/lib/validation/content";
import { ArticleSidebar } from "./_components/article-sidebar";

export const metadata: Metadata = {
  title: "Articles",
  description: "GRs, circulars, land record guides, exam preparation and forms for Talati-cum-Mantri employees of Gujarat.",
  robots: { index: true, follow: true },
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const categories = await getArticleCategories();
  // An unrecognized or stale ?category= value (an old enum-style value, or
  // any slug that doesn't match a current row) simply finds nothing here —
  // categoryId stays undefined, i.e. "show all", never a crash.
  const matched = categories.find((c) => c.slug === rawCategory);
  const categoryId = matched?.id;

  const [articles, counts, latest, blocks] = await Promise.all([
    getArticles(categoryId),
    getArticleCategoryCounts(),
    getLatestArticles(5),
    getPageBlocks("ARTICLES"),
  ]);

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const textBlock = blocks.find((b) => b.type === "TEXT");
  const textData = textBlock?.data as TextBlockData | undefined;
  const heading = textData?.heading ?? "Articles";
  const intro =
    textData?.body ??
    "GRs, circulars, land record guides, exam preparation and forms, organised by subject and date.";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{heading}</h1>
      <p className="mt-2 text-muted-foreground">{intro}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/articles"
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            matched === undefined ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted/40",
          )}
        >
          All ({total})
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/articles?category=${c.slug}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              matched?.slug === c.slug ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            {c.name} ({counts[c.slug]})
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr]">
        <div className="divide-y">
          {articles.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No articles in this category yet.</p>
          ) : (
            articles.map((article) => (
              <article key={article.id} className="py-6">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {article.publishedAt.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span>·</span>
                  <span>{article.category.name}</span>
                </div>
                <Link href={`/articles/${article.id}`} className="mt-1 block">
                  <h2 className="font-heading text-xl font-medium hover:underline">{article.title}</h2>
                </Link>
                <p className="mt-2 text-sm text-muted-foreground">{article.excerpt}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {article.pdfLabel ?? "Read article"}
                </p>
              </article>
            ))
          )}
        </div>

        <ArticleSidebar counts={counts} latest={latest} categories={categories} activeCategory={matched?.slug} />
      </div>
    </div>
  );
}
