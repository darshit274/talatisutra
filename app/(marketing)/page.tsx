import type { Metadata } from "next";
import Link from "next/link";
import { getPageBlocks } from "@/lib/queries/content";
import { getLatestArticles, getLatestArticlesByCategory } from "@/lib/queries/articles";
import { getArticleCategories } from "@/lib/queries/article-categories";
import { SliderBlock } from "@/components/content/slider-block";
import { CardGridBlock } from "@/components/content/card-grid-block";
import { HomeNewsSidebar } from "./_components/home-news-sidebar";
import { HomeNewsletterSection } from "./_components/home-newsletter-section";
import { HomeServicesSection } from "./_components/home-services-section";
import { sliderBlockDataSchema } from "@/lib/validation/content";
import type { TextBlockData, CardGridBlockData } from "@/lib/validation/content";
import { pickLocale, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const [blocks, latestArticles, categories, locale] = await Promise.all([
    getPageBlocks("HOME"),
    getLatestArticles(7),
    getArticleCategories(),
    getLocale(),
  ]);

  const sliderBlock = blocks.find((b) => b.type === "SLIDER");
  const textBlock = blocks.find((b) => b.type === "TEXT");
  const cardGridBlock = blocks.find((b) => b.type === "CARD_GRID");

  // Defensive, not just a cast — this data came back off a Prisma Json column and the
  // save path validates it, but a render path should never trust that blindly (review
  // finding M-6): a malformed row degrades to "no slider" instead of crashing Home.
  const sliderParsed = sliderBlock ? sliderBlockDataSchema.safeParse(sliderBlock.data) : null;
  const slides = sliderParsed?.success ? sliderParsed.data.slides : [];
  const enrichedSlidesWithMaybeCategory = await Promise.all(
    slides.map(async (slide) => {
      const categoryInfo = categories.find((c) => c.slug === slide.category);
      return { ...slide, articles: await getLatestArticlesByCategory(slide.category, 3), categoryInfo };
    }),
  );
  // Drops a slide whose stored slug has no matching category row (e.g. the
  // category was deleted — shouldn't happen given the delete guard, but a
  // render path should never trust stored data blindly) rather than letting
  // an undefined categoryInfo reach SliderBlock.
  const enrichedSlides = enrichedSlidesWithMaybeCategory.filter(
    (slide): slide is typeof slide & { categoryInfo: NonNullable<typeof slide.categoryInfo> } =>
      slide.categoryInfo !== undefined,
  );

  return (
    <>
      {enrichedSlides.length > 0 ? <SliderBlock slides={enrichedSlides} locale={locale} /> : null}

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-[2fr_1fr] md:items-start">
        <div>
          {textBlock ? <TextBlockNoPadding data={textBlock.data as TextBlockData} locale={locale} /> : null}
          <Link href="/about" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            More about us →
          </Link>
        </div>
        <HomeNewsSidebar articles={latestArticles} locale={locale} />
      </div>

      {cardGridBlock ? <CardGridBlock data={cardGridBlock.data as CardGridBlockData} locale={locale} /> : null}

      <HomeNewsletterSection />
      <HomeServicesSection categories={categories} locale={locale} />
    </>
  );
}

// TextBlock wraps itself in a centered, padded <section>, which doesn't fit this
// page's two-column grid cell — same data, no section/padding/centering of its own.
function TextBlockNoPadding({ data, locale }: { data: TextBlockData; locale: Locale }) {
  const heading = data.heading ? pickLocale(locale, data.heading, data.headingGu) : null;
  const body = pickLocale(locale, data.body, data.bodyGu);
  const paragraphs = body.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <div>
      {heading ? <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{heading}</h2> : null}
      <div className="mt-4 space-y-4 text-muted-foreground">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
