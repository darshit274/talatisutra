import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const blocks = await getPageBlocks("HOME");
  return <BlockRenderer blocks={blocks} />;
}
