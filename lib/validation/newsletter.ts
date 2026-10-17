import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
});
