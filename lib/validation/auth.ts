import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Full name is required.").max(200),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number.")
      .max(20)
      .regex(/^[0-9+\-() ]+$/, "Enter a valid phone number."),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[0-9]/, "Include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Include at least one symbol."),
    confirmPassword: z.string(),
    website: z.string().max(0, "Invalid submission.").optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code."),
});
