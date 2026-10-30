import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Disclaimer",
  robots: { index: true, follow: true },
};

export default async function DisclaimerPage() {
  const [blocks, locale] = await Promise.all([getPageBlocks("DISCLAIMER"), getLocale()]);
  return <BlockRenderer blocks={blocks} locale={locale} />;
}
