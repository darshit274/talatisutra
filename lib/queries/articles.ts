import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getArticleCategories } from "@/lib/queries/article-categories";

export async function getLatestArticles(limit: number) {
  return prisma.article.findMany({
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getLatestArticlesByCategory(categorySlug: string, limit: number) {
  return prisma.article.findMany({
    where: { category: { slug: categorySlug } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getArticles(categoryId?: string) {
  return prisma.article.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
}

// Cached per request — the article detail page calls this from both
// generateMetadata and the page component itself (review finding M-6).
export const getArticleById = cache(async (id: string) => {
  return prisma.article.findUnique({ where: { id }, include: { category: true } });
});

export async function getArticleCategoryCounts(): Promise<Record<string, number>> {
  const [counts, categories] = await Promise.all([
    prisma.article.groupBy({ by: ["categoryId"], _count: true }),
    getArticleCategories(),
  ]);
  const countByCategoryId = Object.fromEntries(counts.map((c) => [c.categoryId, c._count]));

  const bySlug: Record<string, number> = {};
  for (const category of categories) {
    bySlug[category.slug] = countByCategoryId[category.id] ?? 0;
  }
  return bySlug;
}
