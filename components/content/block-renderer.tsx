import type { ContentBlock } from "@prisma/client";
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

export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "HERO":
            return <HeroBlock key={block.id} data={block.data as HeroBlockData} />;
          case "TEXT":
            return <TextBlock key={block.id} data={block.data as TextBlockData} />;
          case "CARD_GRID":
            return <CardGridBlock key={block.id} data={block.data as CardGridBlockData} />;
          case "CTA_BAND":
            return <CtaBandBlock key={block.id} data={block.data as CtaBandBlockData} />;
          default:
            return null;
        }
      })}
    </>
  );
}
