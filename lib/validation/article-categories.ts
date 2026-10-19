import { z } from "zod";

export const articleCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  shortDescription: z.string().trim().min(1, "Short description is required.").max(500),
  servicesDescription: z.string().trim().min(1, "Services description is required.").max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(3),
});
export type ArticleCategoryInput = z.infer<typeof articleCategorySchema>;
