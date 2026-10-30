import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getArticles } from "@/lib/queries/articles";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { deleteArticle } from "./actions";
import { ArticleFormDialog } from "./article-form-dialog";
import { ArticleCategoryFilter } from "./article-category-filter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";

export const metadata: Metadata = {
  title: "Articles",
};

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireAdmin("/admin/articles");
  const { category: rawCategory } = await searchParams;
  const categories = await getArticleCategories();
  const category = categories.some((c) => c.id === rawCategory) ? rawCategory : undefined;
  const articles = await getArticles(category);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Articles</h1>
          <p className="text-sm text-muted-foreground">
            {articles.length} article{articles.length === 1 ? "" : "s"}.
          </p>
        </div>
        <ArticleFormDialog mode="create" categories={categories} />
      </div>

      <ArticleCategoryFilter category={category} categories={categories} />

      {articles.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No articles match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Excerpt</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Badge variant="outline">{article.category.name}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{article.title}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {article.excerpt}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {article.publishedAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {article.pdfKey ? <Badge variant="secondary">{article.pdfLabel}</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ArticleFormDialog mode="edit" article={article} categories={categories} />
                      <DeleteConfirmButton
                        action={deleteArticle.bind(null, article.id)}
                        title="Delete this article?"
                        description="This removes it from the public Articles page immediately, and deletes its PDF if it has one."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
