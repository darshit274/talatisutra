import { z } from "zod";
import type { ContentBlockType } from "@prisma/client";

const buttonSchema = z.object({
  label: z.string().trim().min(1, "Button label is required.").max(60),
  href: z.string().trim().min(1, "Button link is required.").max(500),
});

export const heroBlockDataSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required.").max(200),
  subtext: z.string().trim().max(1000),
  buttons: z.array(buttonSchema).max(4),
  imageKey: z.string().nullable(),
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
  imageKey: z.string().nullable(),
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

export const contentBlockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("HERO"), data: heroBlockDataSchema }),
  z.object({ type: z.literal("TEXT"), data: textBlockDataSchema }),
  z.object({ type: z.literal("CARD_GRID"), data: cardGridBlockDataSchema }),
  z.object({ type: z.literal("CTA_BAND"), data: ctaBandBlockDataSchema }),
]);
export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

export const BLOCK_TYPE_LABEL: Record<ContentBlockType, string> = {
  HERO: "Hero",
  TEXT: "Text",
  CARD_GRID: "Card grid",
  CTA_BAND: "CTA band",
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
  }
}
