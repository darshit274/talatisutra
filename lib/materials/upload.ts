import { randomUUID } from "node:crypto";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB (CLAUDE.md rule 6)

export interface SniffedType {
  mime: string;
  ext: string;
  kind: "PDF" | "IMAGE" | "DOCUMENT";
}

/**
 * Sniffs the real file type from magic bytes — never trust the declared MIME type
 * (CLAUDE.md rule 6). Returns null if the bytes don't match any allowed type (PDF,
 * PNG, JPEG, WebP, DOC, DOCX).
 */
export function sniffFileType(buffer: Buffer): SniffedType | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf", kind: "PDF" };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png", kind: "IMAGE" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", kind: "IMAGE" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp", kind: "IMAGE" };
  }

  // Legacy .doc (OLE Compound File Binary Format signature).
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { mime: "application/msword", ext: "doc", kind: "DOCUMENT" };
  }

  // .docx is a ZIP archive — the bare ZIP signature (PK\x03\x04) also matches .xlsx,
  // .pptx, and a generic .zip, so this additionally requires a Word-specific internal
  // entry name before accepting it as a .docx, rather than trusting the ZIP signature
  // alone.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    buffer.includes(Buffer.from("word/document.xml"))
  ) {
    return {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
      kind: "DOCUMENT",
    };
  }

  return null;
}

/**
 * True when the browser-declared MIME type is consistent with the sniffed one
 * (CLAUDE.md rule 6: reject on disagreement). `image/jpg` is a common nonstandard
 * alias some browsers/OSes send for JPEG, accepted as a match.
 */
export function declaredMimeMatchesSniffed(declaredMime: string, sniffed: SniffedType): boolean {
  if (declaredMime === sniffed.mime) return true;
  if (sniffed.mime === "image/jpeg" && declaredMime === "image/jpg") return true;
  return false;
}

export function materialFilePath(storageKey: string): string {
  return path.join(env.STORAGE_DIR, "materials", storageKey);
}

/**
 * Writes a validated upload to disk under a random UUID filename (CLAUDE.md rule 5 —
 * never the user-supplied name) and returns the storageKey to save on the Material
 * row. `ext` must come from the sniffed type, never the upload's declared name/type.
 */
export async function writeUploadedFile(buffer: Buffer, ext: string): Promise<string> {
  const storageKey = `${randomUUID()}.${ext}`;
  const dir = path.join(env.STORAGE_DIR, "materials");
  await mkdir(dir, { recursive: true });
  await writeFile(materialFilePath(storageKey), buffer);
  return storageKey;
}

/** A missing file is not an error (BUILD-PLAN §7 delete step) — used both for real
 * deletes and to clean up after a DB write fails partway through an upload. */
export async function deleteUploadedFile(storageKey: string): Promise<void> {
  try {
    await unlink(materialFilePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete material file:", error);
    }
  }
}
