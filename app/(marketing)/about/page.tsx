import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/queries/content";
import { getSiteSettings } from "@/lib/queries/site-settings";
import { BlockRenderer } from "@/components/content/block-renderer";

export const metadata: Metadata = {
  title: "About",
  robots: { index: true, follow: true },
};

export default async function AboutPage() {
  const [blocks, settings] = await Promise.all([getPageBlocks("ABOUT"), getSiteSettings()]);
  return (
    <>
      <BlockRenderer blocks={blocks} />

      {/* .plate-style placeholder, replaced by the admin-uploaded photo once set
          (BUILD-PLAN §14 placeholder-now-real-later convention). */}
      <div className="mx-auto max-w-3xl px-4">
        {settings.aboutPhotoKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- public marketing asset served from STORAGE_DIR, not a static asset next/image can optimize
          <img
            src={`/api/site-images/${settings.aboutPhotoKey}`}
            alt=""
            className="aspect-video w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
            Photograph coming soon
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm text-muted-foreground">{settings.aboutDisclaimer}</p>
      </div>
    </>
  );
}
