import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const blocks = await getPageBlocks("ABOUT");
  return <BlockRenderer blocks={blocks} />;
}
