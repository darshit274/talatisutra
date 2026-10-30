import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const blocks = await getPageBlocks("PRIVACY");
  return <BlockRenderer blocks={blocks} />;
}
