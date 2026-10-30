import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getVisibleMaterialById } from "@/lib/queries/materials";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// Strip characters that would break the Content-Disposition header (quotes, CR/LF).
// originalName is user-supplied at upload time (Phase 5).
function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n]/g, "");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Same auth + visibility check as every other employee-facing read (BUILD-PLAN §7)
  // — requireUser() redirects unauthenticated requests to /login; a material that
  // doesn't exist or isn't visible to this user 404s, never 403s, so a guesser can't
  // tell "wrong id" from "exists but you can't see it".
  const user = await requireUser();
  const material = await getVisibleMaterialById(user, id);

  if (!material) {
    return new Response(null, { status: 404 });
  }

  const filePath = path.join(env.STORAGE_DIR, "materials", material.storageKey);

  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    // Row exists but the file is missing on disk — treat the same as not found
    // rather than 500ing.
    return new Response(null, { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const disposition = `${download ? "attachment" : "inline"}; filename="${sanitizeFilename(material.originalName)}"`;

  const headers = new Headers({
    "Content-Type": material.mimeType,
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });

  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const [, startStr, endStr] = match;
      const start = startStr ? Number(startStr) : 0;
      const end = endStr ? Number(endStr) : stats.size - 1;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        start < 0 ||
        end >= stats.size
      ) {
        headers.set("Content-Range", `bytes */${stats.size}`);
        return new Response(null, { status: 416, headers });
      }

      headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
      headers.set("Content-Length", String(end - start + 1));

      const nodeStream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
        status: 206,
        headers,
      });
    }
  }

  headers.set("Content-Length", String(stats.size));
  const nodeStream = createReadStream(filePath);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers,
  });
}
