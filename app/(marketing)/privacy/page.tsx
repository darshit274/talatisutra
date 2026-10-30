import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const [blocks, locale] = await Promise.all([getPageBlocks("PRIVACY"), getLocale()]);
  return <BlockRenderer blocks={blocks} locale={locale} />;
}
