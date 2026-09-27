import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
});
