import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { SITE_DOCUMENT_FILENAME_PATTERN, siteDocumentFilePath } from "@/lib/site-documents/storage";

export const runtime = "nodejs";

// No auth check — Articles are free and public by design (spec §2). The filename
// regex is the only defense and must run before any path construction.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (!SITE_DOCUMENT_FILENAME_PATTERN.test(filename)) {
    return new Response(null, { status: 404 });
  }

  const filePath = siteDocumentFilePath(filename);
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return new Response(null, { status: 404 });
  }

  const nodeStream = createReadStream(filePath);

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stats.size),
      // Non-sensitive, and each upload gets a brand-new random filename, so caching
      // this aggressively is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
