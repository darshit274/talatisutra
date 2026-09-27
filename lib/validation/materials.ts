import { z } from "zod";

export const materialMetadataSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    categoryId: z.string().optional().or(z.literal("")),
    visibility: z.enum(["ALL", "DEPARTMENTS"]),
    departmentIds: z.array(z.string()).optional().default([]),
  })
  .refine((data) => data.visibility === "ALL" || data.departmentIds.length > 0, {
    message: "Pick at least one department, or set visibility to All.",
    path: ["departmentIds"],
  });
