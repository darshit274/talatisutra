import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type { SiteSettings } from "@prisma/client";

// Never returns null/undefined — the seed migration guarantees exactly one row.
// If that invariant is ever broken (the row deleted directly against the
// database), throwing here is correct: no caller should silently render with
// undefined contact details.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    throw new Error("SiteSettings row is missing — expected exactly one row to exist.");
  }
  return settings;
});
