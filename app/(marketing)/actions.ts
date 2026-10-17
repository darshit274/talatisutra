"use server";

import { prisma } from "@/lib/db/prisma";
import { newsletterSubscribeSchema } from "@/lib/validation/newsletter";

export interface NewsletterState {
  subscribed: boolean;
  error?: string;
}

export async function subscribeToNewsletter(
  _prevState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSubscribeSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      subscribed: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  // Idempotent — resubmitting an already-subscribed address is not an error.
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: { email: parsed.data.email },
  });

  return { subscribed: true };
}
