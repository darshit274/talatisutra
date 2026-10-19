import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type { ArticleCategory } from "@prisma/client";
import { sliderBlockDataSchema } from "@/lib/validation/content";

export const getArticleCategories = cache(async (): Promise<ArticleCategory[]> => {
  return prisma.articleCategory.findMany({ orderBy: { sortOrder: "asc" } });
});

// A category can be referenced two ways with no shared enforcement: an
// Article's categoryId (a real FK, already RESTRICT-ed at the database
// level) and a SLIDER ContentBlock's per-slide category slug (sitting in a
// JSON blob with no FK at all). Deletion has to check both, or an admin can
// delete a category a slide still points at and leave the homepage slider
// rendering a dangling reference.
export async function isCategoryDeletable(
  categoryId: string,
): Promise<{ deletable: boolean; reason?: string }> {
  const articleCount = await prisma.article.count({ where: { categoryId } });
  if (articleCount > 0) {
    return { deletable: false, reason: "This category still has articles in it." };
  }

  const category = await prisma.articleCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    return { deletable: true };
  }

  const sliderBlocks = await prisma.contentBlock.findMany({ where: { type: "SLIDER" } });
  const referencedInSlider = sliderBlocks.some((block) => {
    const parsed = sliderBlockDataSchema.safeParse(block.data);
    if (!parsed.success) return false;
    return parsed.data.slides.some((slide) => slide.category === category.slug);
  });
  if (referencedInSlider) {
    return { deletable: false, reason: "This category is still used by the homepage slider." };
  }

  return { deletable: true };
}
