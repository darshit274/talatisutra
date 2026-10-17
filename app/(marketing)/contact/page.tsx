import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  robots: { index: true, follow: true },
};

export default async function ContactPage() {
  const blocks = await getPageBlocks("CONTACT");
  return (
    <>
      <BlockRenderer blocks={blocks} />
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <ContactForm />
      </div>
    </>
  );
}
