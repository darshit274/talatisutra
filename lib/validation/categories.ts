import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
