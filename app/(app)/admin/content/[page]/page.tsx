import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUp, ArrowDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getPageBlocks, SITE_PAGE_LABEL, parseSitePageSegment } from "@/lib/queries/content";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { BLOCK_TYPE_LABEL, getBlockPreviewText } from "@/lib/validation/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/admin/delete-confirm-button";
import { ContentBlockFormDialog } from "../content-block-form-dialog";
import { deleteContentBlock, moveContentBlock } from "../actions";
import type { HeroBlockData, TextBlockData, CardGridBlockData, CtaBandBlockData } from "@/lib/validation/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  const parsed = parseSitePageSegment(page);
  return { title: parsed ? SITE_PAGE_LABEL[parsed] : "Site Content" };
}

export default async function AdminContentPageDetail({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: segment } = await params;
  await requireAdmin("/admin/content");

  const page = parseSitePageSegment(segment);
  if (!page) {
    notFound();
  }

  const [blocks, categories] = await Promise.all([getPageBlocks(page), getArticleCategories()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{SITE_PAGE_LABEL[page]}</h1>
        <ContentBlockFormDialog
          mode="create"
          page={page}
          hasSlider={blocks.some((b) => b.type === "SLIDER")}
          categories={categories}
        />
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No blocks yet — add one above.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {blocks.map((block, i) => (
            <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <Badge variant="outline">{BLOCK_TYPE_LABEL[block.type]}</Badge>
                <p className="truncate text-sm">{getBlockPreviewText(block.type, block.data)}</p>
              </div>
              <div className="flex items-center gap-1">
                <form action={moveContentBlock.bind(null, block.id, "up")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={i === 0}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                </form>
                <form action={moveContentBlock.bind(null, block.id, "down")}>
                  <Button type="submit" variant="ghost" size="sm" disabled={i === blocks.length - 1}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                </form>
                <ContentBlockFormDialog
                  mode="edit"
                  id={block.id}
                  type={block.type}
                  data={block.data as HeroBlockData | TextBlockData | CardGridBlockData | CtaBandBlockData}
                  categories={categories}
                />
                <DeleteConfirmButton
                  action={deleteContentBlock.bind(null, block.id)}
                  title={`Delete this ${BLOCK_TYPE_LABEL[block.type]} block?`}
                  description="This removes it from the live page immediately."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
