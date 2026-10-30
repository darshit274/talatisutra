import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

/**
 * All runtime configuration, validated once at boot. A silent `undefined` here becomes
 * a security hole later (BUILD-PLAN §3), so every var is required and typed except the
 * seed-only admin credentials, which are meaningless outside `npm run db:seed`.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // 32+ random bytes, base64 -> at least 44 chars.
  SESSION_SECRET: z.string().min(44, "SESSION_SECRET must be at least 32 random bytes, base64-encoded"),

  STORAGE_DIR: z.string().min(1, "STORAGE_DIR is required"),

  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.enum(["true", "false"]).transform((v) => v === "true"),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  MAIL_FROM: z.string().min(1, "MAIL_FROM is required"),
  CONTACT_NOTIFY_EMAIL: z.string().email("CONTACT_NOTIFY_EMAIL must be a valid email"),

  APP_URL: z.string().url("APP_URL must be a valid URL"),

  // Number of reverse-proxy hops to trust when reading the client IP from
  // X-Forwarded-For (lib/auth/ip.ts). 0 = trust only the socket address (local dev,
  // no proxy). See BUILD-PLAN §4 and §14.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0),

  SEED_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  SEED_ADMIN_PASSWORD: z.string().min(1).optional().or(z.literal("")),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(z.treeifyError(parsed.error));
    throw new Error("Invalid environment variables — see errors above.");
  }

  if (!isProduction) {
    if (!parsed.data.SEED_ADMIN_EMAIL || !parsed.data.SEED_ADMIN_PASSWORD) {
      throw new Error(
        "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required outside production (used by prisma/seed.ts).",
      );
    }
  }

  return parsed.data;
}

export const env = loadEnv();
