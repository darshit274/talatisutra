import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ArticleCategory } from "@prisma/client";
import { cn } from "cn";
import { getArticles, getArticleCategoryCounts, getLatestArticles } from "@/lib/queries/articles";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";
import { ArticleSidebar } from "./_components/article-sidebar";

export const metadata: Metadata = {
  title: "Articles",
  description: "GRs, circulars, land record guides, exam preparation and forms for Talati-cum-Mantri employees of Gujarat.",
  robots: { index: true, follow: true },
};

const categoryParamSchema = z.nativeEnum(ArticleCategory).optional();

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const parsed = categoryParamSchema.safeParse(rawCategory || undefined);
  const category = parsed.success ? parsed.data : undefined;

  const [articles, counts, latest] = await Promise.all([
    getArticles(category),
    getArticleCategoryCounts(),
    getLatestArticles(5),
  ]);

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Articles</h1>
      <p className="mt-2 text-muted-foreground">
        GRs, circulars, land record guides, exam preparation and forms, organised by
        subject and date.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/articles"
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            category === undefined ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted/40",
          )}
        >
          All ({total})
        </Link>
        {CATEGORY_ORDER.map((c) => (
          <Link
            key={c}
            href={`/articles?category=${c}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              category === c ? "border-primary text-primary" : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            {CATEGORY_META[c].label} ({counts[c]})
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
                  <span>{CATEGORY_META[article.category].label}</span>
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

        <ArticleSidebar counts={counts} latest={latest} activeCategory={category} />
      </div>
    </div>
  );
}
