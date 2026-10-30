import { z } from "zod";
import { SITE_IMAGE_FILENAME_PATTERN } from "@/lib/site-images/filename";

// Duplicated from lib/validation/content.ts's private imageKeySchema rather than
// imported, since that const isn't exported — same shape, same reasoning (an
// imageKey flows into deleteSiteImage() -> unlink(), so it must be shaped exactly
// like an upload-produced filename, CLAUDE.md rule 5).
const imageKeySchema = z.string().regex(SITE_IMAGE_FILENAME_PATTERN, "Invalid image key.").nullable();

// A Gujarati counterpart to a required English field above it — optional and
// blank by default, same convention as lib/validation/content.ts's guText.
function guText(max: number) {
  return z.string().trim().max(max).optional().default("");
}

export const siteSettingsInputSchema = z.object({
  contactEmail: z.string().trim().email("Enter a valid email address.").max(200),
  contactPhone: z.string().trim().min(1, "Phone is required.").max(60),
  contactHours: z.string().trim().min(1, "Hours is required.").max(120),
  contactHoursGu: guText(120),
  contactAddress: z.string().trim().min(1, "Address is required.").max(300),
  contactAddressGu: guText(300),
  aboutDisclaimer: z.string().trim().min(1, "Disclaimer text is required.").max(2000),
  aboutDisclaimerGu: guText(2000),
  aboutPhotoKey: imageKeySchema,
  contactMapImageKey: imageKeySchema,
});
export type SiteSettingsInput = z.infer<typeof siteSettingsInputSchema>;
