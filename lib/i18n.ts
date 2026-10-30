// Dependency-free: no next/headers import here, because this module is also
// imported by client components (marketing-header.tsx, slider-block.tsx) —
// same reasoning as lib/validation/content.ts's imageKeySchema comment.
// getLocale/setLocaleCookie (which do need next/headers) live in
// lib/i18n-server.ts instead.

export type Locale = "en" | "gu";

/**
 * The one rule the whole bilingual feature rests on, in the client's own words:
 * "when the text is not added into gujarati it writes the english texts." Every
 * public page picks text through this instead of reading a `*Gu` field directly.
 */
export function pickLocale(locale: Locale, en: string, gu: string | null | undefined): string {
  if (locale === "gu" && gu && gu.trim().length > 0) return gu;
  return en;
}
