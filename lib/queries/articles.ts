import { prisma } from "@/lib/db/prisma";
import type { ArticleCategory } from "@prisma/client";
import { CATEGORY_ORDER } from "@/lib/articles/categories";

export async function getLatestArticles(limit: number) {
  return prisma.article.findMany({ orderBy: { publishedAt: "desc" }, take: limit });
}

export async function getLatestArticlesByCategory(category: ArticleCategory, limit: number) {
  return prisma.article.findMany({
    where: { category },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getArticles(category?: ArticleCategory) {
  return prisma.article.findMany({
    where: category ? { category } : undefined,
    orderBy: { publishedAt: "desc" },
  });
}

export async function getArticleById(id: string) {
  return prisma.article.findUnique({ where: { id } });
}

export async function getArticleCategoryCounts(): Promise<Record<ArticleCategory, number>> {
  const counts = await prisma.article.groupBy({ by: ["category"], _count: true });
  const byCategory = Object.fromEntries(
    counts.map((c) => [c.category, c._count]),
  ) as Record<ArticleCategory, number>;
  for (const cat of CATEGORY_ORDER) byCategory[cat] ??= 0;
  return byCategory;
}
