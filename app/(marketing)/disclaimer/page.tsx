import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "Disclaimer",
  robots: { index: true, follow: true },
};

export default async function DisclaimerPage() {
  const blocks = await getPageBlocks("DISCLAIMER");
  return <BlockRenderer blocks={blocks} />;
}
