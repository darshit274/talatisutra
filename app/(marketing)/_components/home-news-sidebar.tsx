import Link from "next/link";
import type { Article } from "@prisma/client";
import { pickLocale, type Locale } from "@/lib/i18n";

export function HomeNewsSidebar({ articles, locale }: { articles: Article[]; locale: Locale }) {
  return (
    <aside className="rounded-lg border p-6">
      <h2 className="flex items-center gap-2 font-heading text-lg font-medium">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        Latest news
      </h2>
      {articles.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.id}`} className="block hover:underline">
                <p className="text-xs text-muted-foreground">
                  {article.publishedAt.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-1 text-sm font-medium">{pickLocale(locale, article.title, article.titleGu)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No articles published yet.</p>
      )}
      <Link href="/articles" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        All articles →
      </Link>
    </aside>
  );
}
