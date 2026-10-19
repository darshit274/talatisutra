import Link from "next/link";
import type { Article, ArticleCategory } from "@prisma/client";

export function ArticleSidebar({
  counts,
  latest,
  categories,
  activeCategory,
}: {
  counts: Record<string, number>;
  latest: Article[];
  categories: ArticleCategory[];
  activeCategory?: string;
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
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/articles?category=${category.slug}`}
              className={
                "flex items-center justify-between text-sm hover:underline " +
                (activeCategory === category.slug ? "font-medium text-primary" : "text-muted-foreground")
              }
            >
              <span>{category.name}</span>
              <span className="tabular-nums">{counts[category.slug]}</span>
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
