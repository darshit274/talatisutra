import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: true, follow: true },
};

export default async function ServicesPage() {
  const blocks = await getPageBlocks("SERVICES");
  return <BlockRenderer blocks={blocks} />;
}
