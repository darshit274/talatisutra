import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export const MAX_SITE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — smaller than materials' 25 MB

// Exactly the shape writeSiteImage produces: a random UUID plus a sniffed extension.
// The public GET route rejects anything that doesn't match this before touching the
// filesystem (spec §2) — the sole defense against path traversal for this route.
export const SITE_IMAGE_FILENAME_PATTERN = /^[0-9a-f-]+\.(png|jpe?g|webp)$/;

export function siteImageFilePath(key: string): string {
  return path.join(env.STORAGE_DIR, "site-images", key);
}

/** Mirrors lib/materials/upload.ts's writeUploadedFile — random UUID filename
 * (CLAUDE.md rule 5), never the browser-supplied name. */
export async function writeSiteImage(buffer: Buffer, ext: string): Promise<string> {
  const key = `${randomUUID()}.${ext}`;
  const dir = path.join(env.STORAGE_DIR, "site-images");
  await mkdir(dir, { recursive: true });
  await writeFile(siteImageFilePath(key), buffer);
  return key;
}

/** A missing file is not an error — same reasoning as deleteUploadedFile in
 * lib/materials/upload.ts (used both for real deletes and to clean up after a failed
 * write). */
export async function deleteSiteImage(key: string): Promise<void> {
  try {
    await unlink(siteImageFilePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete site image:", error);
    }
  }
}
