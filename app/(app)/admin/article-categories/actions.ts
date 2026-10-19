"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { articleCategorySchema } from "@/lib/validation/article-categories";
import { getArticleCategories, isCategoryDeletable } from "@/lib/queries/article-categories";
import { DEFAULT_ICON_KEY } from "@/lib/articles/icons";
import { sliderBlockDataSchema } from "@/lib/validation/content";
import type { Prisma } from "@prisma/client";

export interface CategoryFormState {
  error?: string;
}

function parseCategoryInput(formData: FormData) {
  const tags = [formData.get("tag1"), formData.get("tag2"), formData.get("tag3")]
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0);

  return articleCategorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    servicesDescription: formData.get("servicesDescription"),
    tags,
  });
}

// The HOME page's SLIDER block stores each slide's category as a slug
// inside a JSON blob with no foreign key — renaming a category's slug would
// otherwise leave any slide that referenced the old slug pointing at
// nothing (the same dangling-reference class the delete guard exists to
// prevent, just triggered by a rename instead of a delete). Returns the
// Prisma update operations needed to retarget every affected slide from
// oldSlug to newSlug, to be run in the same transaction as the category
// update itself.
async function buildSliderSlugRewriteOps(oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return [];

  const sliderBlocks = await prisma.contentBlock.findMany({ where: { type: "SLIDER" } });
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const block of sliderBlocks) {
    const parsed = sliderBlockDataSchema.safeParse(block.data);
    if (!parsed.success) continue;
    if (!parsed.data.slides.some((slide) => slide.category === oldSlug)) continue;

    const data = {
      slides: parsed.data.slides.map((slide) =>
        slide.category === oldSlug ? { ...slide, category: newSlug } : slide,
      ),
    };
    ops.push(prisma.contentBlock.update({ where: { id: block.id }, data: { data } }));
  }

  return ops;
}

function revalidateArticleCategoryPaths() {
  revalidatePath("/admin/article-categories");
  revalidatePath("/");
  revalidatePath("/services");
}

export async function createArticleCategory(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const admin = await requireAdmin("/admin/article-categories");
  const parsed = parseCategoryInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await prisma.articleCategory.findFirst({
    where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
  });
  if (existing) {
    return {
      error:
        existing.name === parsed.data.name
          ? "A category with this name already exists."
          : "A category with this slug already exists.",
    };
  }

  // max+1, not count(): deletes leave gaps, so count() can hand a new
  // category the same sortOrder as a surviving sibling, turning Move up/down
  // into a no-op swap for that tied pair (same bug class already fixed for
  // ContentBlock — see app/(app)/admin/content/actions.ts).
  const maxRow = await prisma.articleCategory.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const category = await prisma.articleCategory.create({
    data: { ...parsed.data, icon: DEFAULT_ICON_KEY, sortOrder: (maxRow?.sortOrder ?? -1) + 1 },
  });

  await writeAuditLog({
    actor: admin,
    action: "article-category.create",
    entity: "ArticleCategory",
    entityId: category.id,
    meta: { name: category.name, slug: category.slug },
    ip: getClientIp(await headers()),
  });

  revalidateArticleCategoryPaths();
  return {};
}

export async function updateArticleCategory(
  id: string,
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const admin = await requireAdmin("/admin/article-categories");
  const current = await prisma.articleCategory.findUnique({ where: { id } });
  if (!current) {
    return { error: "This category no longer exists." };
  }

  const parsed = parseCategoryInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  // `id: { not: id }` excludes the row being edited at the query level —
  // checking `existing.id !== id` only *after* the fact was a real bug
  // (found during Task 15's verification pass): when the admin changes only
  // the name and leaves slug untouched, findFirst's OR could match the row
  // being edited itself via its own unchanged slug instead of the actual
  // colliding row via name, since OR with no ordering doesn't guarantee
  // which match comes back — silently skipping the check and letting a raw
  // unique-constraint error crash the page instead of a clean form error.
  const existing = await prisma.articleCategory.findFirst({
    where: { id: { not: id }, OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
  });
  if (existing) {
    return {
      error:
        existing.name === parsed.data.name
          ? "A category with this name already exists."
          : "A category with this slug already exists.",
    };
  }

  const sliderRewriteOps = await buildSliderSlugRewriteOps(current.slug, parsed.data.slug);
  await prisma.$transaction([
    prisma.articleCategory.update({ where: { id }, data: parsed.data }),
    ...sliderRewriteOps,
  ]);

  await writeAuditLog({
    actor: admin,
    action: "article-category.update",
    entity: "ArticleCategory",
    entityId: id,
    meta: { name: parsed.data.name, slug: parsed.data.slug, slidesRewritten: sliderRewriteOps.length },
    ip: getClientIp(await headers()),
  });

  revalidateArticleCategoryPaths();
  revalidatePath("/articles");
  return {};
}

export async function deleteArticleCategory(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/article-categories");

  const { deletable, reason } = await isCategoryDeletable(id);
  if (!deletable) {
    redirect(`/admin/article-categories?error=${encodeURIComponent(reason ?? "This category can't be deleted.")}`);
  }

  const category = await prisma.articleCategory.findUnique({ where: { id } });
  if (!category) {
    redirect("/admin/article-categories");
  }

  await prisma.articleCategory.delete({ where: { id } });

  await writeAuditLog({
    actor: admin,
    action: "article-category.delete",
    entity: "ArticleCategory",
    entityId: id,
    meta: { name: category.name, slug: category.slug },
    ip: getClientIp(await headers()),
  });

  revalidateArticleCategoryPaths();
  revalidatePath("/articles");
  redirect("/admin/article-categories");
}

export async function moveArticleCategory(id: string, direction: "up" | "down"): Promise<void> {
  await requireAdmin("/admin/article-categories");

  const categories = await getArticleCategories();
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) {
    redirect("/admin/article-categories");
  }
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (swapIndex >= 0 && swapIndex < categories.length) {
    const current = categories[index];
    const other = categories[swapIndex];
    await prisma.$transaction([
      prisma.articleCategory.update({ where: { id: current.id }, data: { sortOrder: other.sortOrder } }),
      prisma.articleCategory.update({ where: { id: other.id }, data: { sortOrder: current.sortOrder } }),
    ]);
  }

  revalidateArticleCategoryPaths();
}
