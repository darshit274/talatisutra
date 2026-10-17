import { z } from "zod";
import { ArticleCategory } from "@prisma/client";

export const articleInputSchema = z.object({
  category: z.nativeEnum(ArticleCategory),
  title: z.string().trim().min(1, "Title is required.").max(200),
  excerpt: z.string().trim().min(1, "Excerpt is required.").max(300),
  body: z.string().trim().min(1, "Body is required.").max(20000),
  pdfKey: z.string().nullable(),
  pdfLabel: z.string().nullable(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;
