import { z } from "zod";
import { ArticleCategory } from "@prisma/client";
import type { ContentBlockType } from "@prisma/client";
// Imported from the dependency-free ./filename module rather than ./storage, because this
// file is also imported by client components and storage.ts pulls in node:fs and
// @/lib/env (which throws without server env vars).
import { SITE_IMAGE_FILENAME_PATTERN } from "@/lib/site-images/filename";

// An imageKey flows into deleteSiteImage() -> path.join(STORAGE_DIR, "site-images", key)
// -> unlink() when it's orphaned, so it must be shaped exactly like an upload-produced
// filename — never anything containing a separator or `..` (CLAUDE.md rule 5).
const imageKeySchema = z.string().regex(SITE_IMAGE_FILENAME_PATTERN, "Invalid image key.").nullable();

const buttonSchema = z.object({
  label: z.string().trim().min(1, "Button label is required.").max(60),
  href: z.string().trim().min(1, "Button link is required.").max(500),
});

export const heroBlockDataSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  subtext: z.string().trim().max(1000),
  buttons: z.array(buttonSchema).max(4),
  imageKey: imageKeySchema,
});
export type HeroBlockData = z.infer<typeof heroBlockDataSchema>;

export const textBlockDataSchema = z.object({
  heading: z.string().trim().max(200).nullable(),
  body: z.string().trim().min(1, "Body text is required.").max(5000),
});
export type TextBlockData = z.infer<typeof textBlockDataSchema>;

const cardSchema = z.object({
  title: z.string().trim().min(1, "Card title is required.").max(120),
  body: z.string().trim().min(1, "Card body is required.").max(1000),
  imageKey: imageKeySchema,
});

export const cardGridBlockDataSchema = z.object({
  heading: z.string().trim().max(200).nullable(),
  subtext: z.string().trim().max(1000).nullable(),
  cards: z.array(cardSchema).min(1, "Add at least one card.").max(12),
});
export type CardGridBlockData = z.infer<typeof cardGridBlockDataSchema>;

export const ctaBandBlockDataSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  subtext: z.string().trim().max(1000),
  button: buttonSchema,
});
export type CtaBandBlockData = z.infer<typeof ctaBandBlockDataSchema>;

const sliderSlideSchema = z.object({
  kicker: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  subtext: z.string().trim().max(500),
  ctaLabel: z.string().trim().min(1).max(60),
  category: z.nativeEnum(ArticleCategory),
});
export const sliderBlockDataSchema = z.object({
  slides: z.array(sliderSlideSchema).min(1).max(5),
});
export type SliderBlockData = z.infer<typeof sliderBlockDataSchema>;

export const contentBlockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("HERO"), data: heroBlockDataSchema }),
  z.object({ type: z.literal("TEXT"), data: textBlockDataSchema }),
  z.object({ type: z.literal("CARD_GRID"), data: cardGridBlockDataSchema }),
  z.object({ type: z.literal("CTA_BAND"), data: ctaBandBlockDataSchema }),
  z.object({ type: z.literal("SLIDER"), data: sliderBlockDataSchema }),
]);
export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

export const BLOCK_TYPE_LABEL: Record<ContentBlockType, string> = {
  HERO: "Hero",
  TEXT: "Text",
  CARD_GRID: "Card grid",
  CTA_BAND: "CTA band",
  SLIDER: "Slider",
};

/** Every image key a block's data references, for orphan-cleanup diffing (Task 7) —
 * HERO has at most one, CARD_GRID has one per card, TEXT/CTA_BAND have none. */
export function extractImageKeys(block: ContentBlockInput): string[] {
  switch (block.type) {
    case "HERO":
      return block.data.imageKey ? [block.data.imageKey] : [];
    case "CARD_GRID":
      return block.data.cards
        .map((card) => card.imageKey)
        .filter((key): key is string => key !== null);
    case "TEXT":
    case "CTA_BAND":
    case "SLIDER":
      return [];
  }
}

/** A short one-line preview for an admin list row (spec §4): the block's heading, or the
 * first line of its body for a TEXT block with no heading. `data` arrives as `unknown`
 * because callers read it straight off a Prisma `Json` column — this never throws on a
 * shape mismatch, it just falls back to the type label, since it's display-only. */
export function getBlockPreviewText(type: ContentBlockType, data: unknown): string {
  const parsed = contentBlockInputSchema.safeParse({ type, data });
  if (!parsed.success) return BLOCK_TYPE_LABEL[type];

  switch (parsed.data.type) {
    case "HERO":
      return parsed.data.data.heading;
    case "CTA_BAND":
      return parsed.data.data.heading;
    case "CARD_GRID":
      return parsed.data.data.heading ?? `${parsed.data.data.cards.length} card(s)`;
    case "TEXT":
      return parsed.data.data.heading ?? parsed.data.data.body.split("\n")[0];
    case "SLIDER":
      return parsed.data.data.slides[0]?.title ?? BLOCK_TYPE_LABEL.SLIDER;
  }
}
