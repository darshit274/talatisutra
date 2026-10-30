import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { BlockRenderer } from "@/components/content/block-renderer";
import { ContactForm } from "./contact-form";
import { ContactDetails } from "./_components/contact-details";

export const metadata: Metadata = {
  title: "Contact",
  robots: { index: true, follow: true },
};

export default async function ContactPage() {
  const [blocks, settings] = await Promise.all([getPageBlocks("CONTACT"), getSiteSettings()]);
  return (
    <>
      <BlockRenderer blocks={blocks} />
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 md:grid-cols-[2fr_1fr]">
        <ContactForm />
        <ContactDetails settings={settings} />
      </div>
    </>
  );
}
