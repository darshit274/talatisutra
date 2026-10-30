import type { Metadata } from "next";
import { ArrowUp, ArrowDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getArticleCategories, isCategoryDeletable } from "@/lib/queries/article-categories";
import { resolveIcon } from "@/lib/articles/icons";
import { prisma } from "@/lib/db/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { CategoryFormDialog } from "./category-form-dialog";
import { deleteArticleCategory, moveArticleCategory } from "./actions";

export const metadata: Metadata = {
  title: "Article Categories",
};

export default async function AdminArticleCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin("/admin/article-categories");
  const { error } = await searchParams;

  const categories = await getArticleCategories();
  const rows = await Promise.all(
    categories.map(async (category) => {
      const [{ deletable, reason }, articleCount] = await Promise.all([
        isCategoryDeletable(category.id),
        prisma.article.count({ where: { categoryId: category.id } }),
      ]);
      return { category, deletable, reason, articleCount };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Article Categories</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}.
          </p>
        </div>
        <CategoryFormDialog mode="create" />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ category, deletable, reason, articleCount }, i) => {
              const Icon = resolveIcon(category.icon);
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                  <TableCell className="text-muted-foreground">{articleCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <form action={moveArticleCategory.bind(null, category.id, "up")}>
                        <Button type="submit" variant="ghost" size="sm" disabled={i === 0}>
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                      </form>
                      <form action={moveArticleCategory.bind(null, category.id, "down")}>
                        <Button type="submit" variant="ghost" size="sm" disabled={i === rows.length - 1}>
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CategoryFormDialog
                        mode="edit"
                        id={category.id}
                        name={category.name}
                        slug={category.slug}
                        shortDescription={category.shortDescription}
                        servicesDescription={category.servicesDescription}
                        tags={category.tags as string[]}
                      />
                      <DeleteConfirmButton
                        action={deleteArticleCategory.bind(null, category.id)}
                        title={`Delete "${category.name}"?`}
                        description="This removes the category from Services, the Home grid and the footer immediately."
                        disabled={!deletable}
                        disabledReason={reason}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
