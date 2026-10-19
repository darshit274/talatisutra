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

  const count = await prisma.articleCategory.count();
  const category = await prisma.articleCategory.create({
    data: { ...parsed.data, icon: DEFAULT_ICON_KEY, sortOrder: count },
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
  const parsed = parseCategoryInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const existing = await prisma.articleCategory.findFirst({
    where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
  });
  if (existing && existing.id !== id) {
    return {
      error:
        existing.name === parsed.data.name
          ? "A category with this name already exists."
          : "A category with this slug already exists.",
    };
  }

  await prisma.articleCategory.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    actor: admin,
    action: "article-category.update",
    entity: "ArticleCategory",
    entityId: id,
    meta: { name: parsed.data.name, slug: parsed.data.slug },
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
