import type { ContentBlock } from "@prisma/client";
import type { Locale } from "@/lib/i18n";
import { HeroBlock } from "./hero-block";
import { TextBlock } from "./text-block";
import { CardGridBlock } from "./card-grid-block";
import { CtaBandBlock } from "./cta-band-block";
import type {
  HeroBlockData,
  TextBlockData,
  CardGridBlockData,
  CtaBandBlockData,
} from "@/lib/validation/content";

export function BlockRenderer({ blocks, locale }: { blocks: ContentBlock[]; locale: Locale }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "HERO":
            return <HeroBlock key={block.id} data={block.data as HeroBlockData} locale={locale} />;
          case "TEXT":
            return <TextBlock key={block.id} data={block.data as TextBlockData} locale={locale} />;
          case "CARD_GRID":
            return <CardGridBlock key={block.id} data={block.data as CardGridBlockData} locale={locale} />;
          case "CTA_BAND":
            return <CtaBandBlock key={block.id} data={block.data as CtaBandBlockData} locale={locale} />;
          case "SLIDER":
            // SLIDER is never rendered through this component — it needs server-fetched
            // Article enrichment BlockRenderer doesn't have (Task 15 renders it directly).
            // This branch exists only as a defensive no-op if one ever reaches here.
            return null;
          default:
            return null;
        }
      })}
    </>
  );
}
