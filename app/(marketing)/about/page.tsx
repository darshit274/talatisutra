import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "About",
  robots: { index: true, follow: true },
};

export default async function AboutPage() {
  const blocks = await getPageBlocks("ABOUT");
  return (
    <>
      <BlockRenderer blocks={blocks} />

      {/* .plate-style placeholder — swap for a real office/team photo once the client
          supplies one (BUILD-PLAN §14 placeholder-now-real-later convention). */}
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
          Photograph coming soon
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm text-muted-foreground">
          Talatisutra is an independent information resource and is not an official
          website of the Government of Gujarat or the Government of India.
        </p>
      </div>
    </>
  );
}
