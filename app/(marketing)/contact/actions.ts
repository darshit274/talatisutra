"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/auth/ip";
import { isContactFormThrottled, recordContactFormSubmission } from "@/lib/auth/throttle";
import { sendContactEnquiryEmail } from "@/lib/mail";
import { contactSchema } from "@/lib/validation/contact";

export interface ContactState {
  submitted: boolean;
  error?: string;
}

const THROTTLED_ERROR = "Too many messages sent. Please try again in a few minutes.";

export async function submitContactForm(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    district: formData.get("district"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return {
      submitted: false,
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { name, email, phone, district, subject, message, website } = parsed.data;

  // Honeypot tripped — pretend success so the bot doesn't learn it was caught, but
  // don't save the row or send mail.
  if (website) {
    return { submitted: true };
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (await isContactFormThrottled(email, ip)) {
    return { submitted: false, error: THROTTLED_ERROR };
  }

  await recordContactFormSubmission(email, ip);

  // Save first — a broken SMTP config must not lose the enquiry (BUILD-PLAN §8, §12
  // manual test item 12).
  await prisma.contactEnquiry.create({
    data: { name, email, phone: phone || null, district, subject, message },
  });

  await sendContactEnquiryEmail({
    name,
    email,
    phone,
    district: district ?? undefined,
    subject: subject ?? undefined,
    message,
  });

  return { submitted: true };
}
