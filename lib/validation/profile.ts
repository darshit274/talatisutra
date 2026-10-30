import { z } from "zod";

// Deliberately excludes email, role, department and employeeCode — those stay
// admin-managed (CLAUDE.md rule 3: never trust identity/org fields from the user's own
// submission). Self-service editing is limited to contact details.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  designation: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
});
