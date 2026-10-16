import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { SITE_IMAGE_FILENAME_PATTERN, siteImageFilePath } from "@/lib/site-images/storage";

export const runtime = "nodejs";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// No auth check — these are public marketing assets by design (spec §2). The filename
// regex is the only defense and must run before any path construction.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (!SITE_IMAGE_FILENAME_PATTERN.test(filename)) {
    return new Response(null, { status: 404 });
  }

  const filePath = siteImageFilePath(filename);
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return new Response(null, { status: 404 });
  }

  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const nodeStream = createReadStream(filePath);

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": EXT_TO_MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(stats.size),
      // Non-sensitive, and each upload gets a brand-new random filename (replacing an
      // image never reuses the old key), so caching this aggressively is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
