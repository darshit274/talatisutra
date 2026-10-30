import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  SITE_DOCUMENT_FILENAME_PATTERN,
  siteDocumentFilePath,
  deleteSiteDocument,
} from "@/lib/site-documents/storage";
import { prisma } from "@/lib/db/prisma";

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
      // Only sniffed PDFs ever land here (CLAUDE.md rule 6), but nosniff is cheap
      // defense-in-depth against a browser second-guessing the declared type, and a
      // real filename (rather than the opaque UUID key) is friendlier on download
      // (review finding M-7).
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="document.pdf"',
    },
  });
}

// Lets the admin Article dialog clean up a PDF it uploaded but never saved —
// replaced by picking a different file, or abandoned by cancelling the dialog
// (review finding M-4). Refuses to delete a key any Article is still using, so a
// stale client request can never take down a live download link.
export async function DELETE(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  await requireAdmin();
  const { filename } = await params;

  if (!SITE_DOCUMENT_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid key." }, { status: 400 });
  }

  const inUse = await prisma.article.findFirst({ where: { pdfKey: filename }, select: { id: true } });
  if (inUse) {
    return NextResponse.json({ error: "This file is attached to a published article." }, { status: 409 });
  }

  await deleteSiteDocument(filename);
  return new Response(null, { status: 204 });
}
