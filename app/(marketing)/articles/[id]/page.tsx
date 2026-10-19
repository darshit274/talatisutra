import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getArticleById, getArticleCategoryCounts, getLatestArticles } from "@/lib/queries/articles";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { ArticleSidebar } from "../_components/article-sidebar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt,
    robots: { index: true, follow: true },
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) {
    notFound();
  }

  const [counts, latest, categories] = await Promise.all([
    getArticleCategoryCounts(),
    getLatestArticles(5),
    getArticleCategories(),
  ]);
  const paragraphs = article.body.split("\n\n").filter((p) => p.trim().length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Link href={`/articles?category=${article.category.slug}`} className="text-sm text-primary hover:underline">
        ← Back to {article.category.name}
      </Link>

      <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr]">
        <article>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{article.category.name}</span>
            <span>·</span>
            <span>
              {article.publishedAt.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">{article.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>

          <div className="mt-8 space-y-4 text-muted-foreground">
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-8 rounded-lg border p-5">
            <h2 className="font-heading text-base font-medium">What it means for your office</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check this against any case you already have in progress, and update your
              own records or register entries to match before the next inspection or
              Gram Sabha.
            </p>
          </div>

          {article.pdfKey ? (
            <a
              href={`/api/site-documents/${article.pdfKey}`}
              className="mt-8 flex items-center gap-3 rounded-lg border p-5 hover:bg-muted/40"
            >
              <Download className="size-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Download the document</p>
                <p className="text-xs text-muted-foreground">{article.pdfLabel}</p>
              </div>
            </a>
          ) : null}
        </article>

        <ArticleSidebar counts={counts} latest={latest} categories={categories} activeCategory={article.category.slug} />
      </div>
    </div>
  );
}
