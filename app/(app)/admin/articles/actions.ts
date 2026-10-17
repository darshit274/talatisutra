"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import { deleteSiteDocument } from "@/lib/site-documents/storage";
import { articleInputSchema } from "@/lib/validation/articles";
import { getArticleById } from "@/lib/queries/articles";

export interface ArticleFormState {
  error?: string;
}

function parseArticleInput(formData: FormData) {
  return articleInputSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    pdfKey: formData.get("pdfKey") || null,
    pdfLabel: formData.get("pdfLabel") || null,
  });
}

function revalidateArticlePaths(id?: string) {
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
  if (id) revalidatePath(`/articles/${id}`);
}

export async function createArticle(
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const admin = await requireAdmin("/admin/articles");
  const parsed = parseArticleInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const article = await prisma.article.create({
    data: { ...parsed.data, updatedById: admin.id },
  });

  await writeAuditLog({
    actor: admin,
    action: "article.create",
    entity: "Article",
    entityId: article.id,
    meta: { category: article.category },
    ip: getClientIp(await headers()),
  });

  revalidateArticlePaths(article.id);
  return {};
}

export async function updateArticle(
  id: string,
  _prevState: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const admin = await requireAdmin("/admin/articles");
  const existing = await getArticleById(id);
  if (!existing) {
    return { error: "This article no longer exists." };
  }

  const parsed = parseArticleInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  await prisma.article.update({
    where: { id },
    data: { ...parsed.data, updatedById: admin.id },
  });

  if (existing.pdfKey && existing.pdfKey !== parsed.data.pdfKey) {
    await deleteSiteDocument(existing.pdfKey);
  }

  await writeAuditLog({
    actor: admin,
    action: "article.update",
    entity: "Article",
    entityId: id,
    meta: { category: parsed.data.category },
    ip: getClientIp(await headers()),
  });

  revalidateArticlePaths(id);
  return {};
}

export async function deleteArticle(id: string): Promise<void> {
  const admin = await requireAdmin("/admin/articles");
  const existing = await getArticleById(id);
  if (!existing) {
    redirect("/admin/articles");
  }

  await prisma.article.delete({ where: { id } });

  if (existing.pdfKey) {
    await deleteSiteDocument(existing.pdfKey);
  }

  await writeAuditLog({
    actor: admin,
    action: "article.delete",
    entity: "Article",
    entityId: id,
    meta: { category: existing.category },
    ip: getClientIp(await headers()),
  });

  revalidateArticlePaths(id);
  redirect("/admin/articles");
}
