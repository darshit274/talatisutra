import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  // Honeypot — a real visitor never sees or fills this field, same convention as
  // the contact form (CLAUDE.md-adjacent abuse-prevention pattern already used there).
  website: z.string().optional(),
});
