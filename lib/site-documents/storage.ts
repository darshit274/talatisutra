import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export const MAX_SITE_DOCUMENT_BYTES = 15 * 1024 * 1024; // spec §2

// Only PDFs land here — every upload is sniffed to this extension (CLAUDE.md rule 6).
export const SITE_DOCUMENT_FILENAME_PATTERN = /^[0-9a-f-]+\.pdf$/;

export function siteDocumentFilePath(key: string): string {
  return path.join(env.STORAGE_DIR, "site-documents", key);
}

/** Mirrors lib/site-images/storage.ts's writeSiteImage — random UUID filename
 * (CLAUDE.md rule 5), never the browser-supplied name. */
export async function writeSiteDocument(buffer: Buffer): Promise<string> {
  const key = `${randomUUID()}.pdf`;
  const dir = path.join(env.STORAGE_DIR, "site-documents");
  await mkdir(dir, { recursive: true });
  await writeFile(siteDocumentFilePath(key), buffer);
  return key;
}

/** A missing file is not an error — same reasoning as deleteSiteImage. */
export async function deleteSiteDocument(key: string): Promise<void> {
  try {
    await unlink(siteDocumentFilePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete site document:", error);
    }
  }
}
