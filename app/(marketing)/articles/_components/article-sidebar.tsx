import Link from "next/link";
import type { Article, ArticleCategory } from "@prisma/client";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/articles/categories";

export function ArticleSidebar({
  counts,
  latest,
  activeCategory,
}: {
  counts: Record<ArticleCategory, number>;
  latest: Article[];
  activeCategory?: ArticleCategory;
}) {
  return (
    <aside className="space-y-8">
      <div className="rounded-lg border p-6">
        <h2 className="font-heading text-lg font-medium">Categories</h2>
        <nav className="mt-4 flex flex-col gap-2">
          <Link
            href="/articles"
            className={
              "flex items-center justify-between text-sm hover:underline " +
              (activeCategory === undefined ? "font-medium text-primary" : "text-muted-foreground")
            }
          >
            All
          </Link>
          {CATEGORY_ORDER.map((category) => (
            <Link
              key={category}
              href={`/articles?category=${category}`}
              className={
                "flex items-center justify-between text-sm hover:underline " +
                (activeCategory === category ? "font-medium text-primary" : "text-muted-foreground")
              }
            >
              <span>{CATEGORY_META[category].label}</span>
              <span className="tabular-nums">{counts[category]}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-heading text-lg font-medium">Latest news</h2>
        {latest.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {latest.map((article) => (
              <li key={article.id}>
                <Link href={`/articles/${article.id}`} className="text-sm hover:underline">
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No articles published yet.</p>
        )}
      </div>
    </aside>
  );
}
