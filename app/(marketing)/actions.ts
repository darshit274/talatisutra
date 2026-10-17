"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/auth/ip";
import { isNewsletterSubscribeThrottled, recordNewsletterSubscribeAttempt } from "@/lib/auth/throttle";
import { newsletterSubscribeSchema } from "@/lib/validation/newsletter";

export interface NewsletterState {
  subscribed: boolean;
  error?: string;
}

const THROTTLED_ERROR = "Too many attempts. Please try again in a few minutes.";

export async function subscribeToNewsletter(
  _prevState: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSubscribeSchema.safeParse({
    email: formData.get("email"),
    website: formData.get("website"),
  });
  if (!parsed.success) {
    return {
      subscribed: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  // Honeypot tripped — pretend success so the bot doesn't learn it was caught, but
  // don't write the row.
  if (parsed.data.website) {
    return { subscribed: true };
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isNewsletterSubscribeThrottled(parsed.data.email, ip)) {
    return { subscribed: false, error: THROTTLED_ERROR };
  }

  await recordNewsletterSubscribeAttempt(parsed.data.email, ip);

  // Idempotent — resubmitting an already-subscribed address is not an error.
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: { email: parsed.data.email },
  });

  return { subscribed: true };
}
