import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  // The District <Select> submits "" (its hidden input's unset value), not an absent
  // key, when nothing is chosen — normalize that to null rather than storing "".
  district: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((v) => (v ? v : null)),
  subject: z.enum(["Missing document", "Procedure question", "Exam material", "Other"]).nullable(),
  message: z.string().trim().min(1, "Message is required.").max(5000),
  // Honeypot — a real visitor never sees or fills this field (the form hides it
  // off-screen, see contact-form.tsx). Any non-empty value here means a bot filled
  // every input it could find; the caller drops the submission silently.
  website: z.string().optional(),
});
