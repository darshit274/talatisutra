import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export default async function HomePage() {
  const blocks = await getPageBlocks("HOME");
  return <BlockRenderer blocks={blocks} />;
}
