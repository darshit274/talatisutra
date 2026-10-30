import { prisma } from "@/lib/db/prisma";

export async function getNewsletterSubscribers() {
  return prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
}
