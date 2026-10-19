import type { Metadata } from "next";
import Link from "next/link";
import { getPageBlocks } from "@/lib/queries/content";
import { getLatestArticles, getLatestArticlesByCategory } from "@/lib/queries/articles";
import { SliderBlock } from "@/components/content/slider-block";
import { CardGridBlock } from "@/components/content/card-grid-block";
import { HomeNewsSidebar } from "./_components/home-news-sidebar";
import { HomeNewsletterSection } from "./_components/home-newsletter-section";
import { HomeServicesSection } from "./_components/home-services-section";
import { sliderBlockDataSchema } from "@/lib/validation/content";
import type { TextBlockData, CardGridBlockData } from "@/lib/validation/content";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const [blocks, latestArticles] = await Promise.all([
    getPageBlocks("HOME"),
    getLatestArticles(7),
  ]);

  const sliderBlock = blocks.find((b) => b.type === "SLIDER");
  const textBlock = blocks.find((b) => b.type === "TEXT");
  const cardGridBlock = blocks.find((b) => b.type === "CARD_GRID");

  // Defensive, not just a cast — this data came back off a Prisma Json column and the
  // save path validates it, but a render path should never trust that blindly (review
  // finding M-6): a malformed row degrades to "no slider" instead of crashing Home.
  const sliderParsed = sliderBlock ? sliderBlockDataSchema.safeParse(sliderBlock.data) : null;
  const slides = sliderParsed?.success ? sliderParsed.data.slides : [];
  const enrichedSlides = await Promise.all(
    slides.map(async (slide) => ({
      ...slide,
      articles: await getLatestArticlesByCategory(slide.category, 3),
    })),
  );

  return (
    <>
      {enrichedSlides.length > 0 ? <SliderBlock slides={enrichedSlides} /> : null}

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-[2fr_1fr] md:items-start">
        <div>
          {textBlock ? <TextBlockNoPadding data={textBlock.data as TextBlockData} /> : null}
          <Link href="/about" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            More about us →
          </Link>
        </div>
        <HomeNewsSidebar articles={latestArticles} />
      </div>

      {cardGridBlock ? <CardGridBlock data={cardGridBlock.data as CardGridBlockData} /> : null}

      <HomeNewsletterSection />
      <HomeServicesSection />
    </>
  );
}

// TextBlock wraps itself in a centered, padded <section>, which doesn't fit this
// page's two-column grid cell — same data, no section/padding/centering of its own.
function TextBlockNoPadding({ data }: { data: TextBlockData }) {
  const paragraphs = data.body.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <div>
      {data.heading ? <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{data.heading}</h2> : null}
      <div className="mt-4 space-y-4 text-muted-foreground">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
