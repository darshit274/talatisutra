import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
};

// Placeholder copy — replace with the client's real contact details (BUILD-PLAN §14).
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-4 text-muted-foreground">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Send us a message and
        we&apos;ll get back to you.
      </p>

      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
