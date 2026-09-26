import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton: without this, every hot reload creates a new
// PrismaClient (and a new connection pool) since modules are re-evaluated but the
// Node process persists.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
