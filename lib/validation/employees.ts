import { z } from "zod";

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
  departmentId: z.string().optional().or(z.literal("")),
  designation: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  employeeCode: z.string().trim().max(50).optional().or(z.literal("")),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
