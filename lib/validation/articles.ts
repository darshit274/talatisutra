import { z } from "zod";
import { SITE_DOCUMENT_FILENAME_PATTERN } from "@/lib/site-documents/storage";

// A pdfKey flows into deleteSiteDocument() -> path.join(STORAGE_DIR, "site-documents", key)
// -> unlink() when it's orphaned or replaced, so it must be shaped exactly like an
// upload-produced filename — never anything containing a separator or ".." (CLAUDE.md
// rule 5), same reasoning as lib/validation/content.ts's imageKeySchema.
const pdfKeySchema = z.string().regex(SITE_DOCUMENT_FILENAME_PATTERN, "Invalid PDF key.").nullable();

export const articleInputSchema = z.object({
  categoryId: z.string().min(1, "Choose a category."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  excerpt: z.string().trim().min(1, "Excerpt is required.").max(300),
  body: z.string().trim().min(1, "Body is required.").max(20000),
  pdfKey: pdfKeySchema,
  pdfLabel: z.string().max(60).nullable(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;
