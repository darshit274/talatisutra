import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { sniffFileType, declaredMimeMatchesSniffed } from "@/lib/materials/upload";
import { MAX_SITE_DOCUMENT_BYTES, writeSiteDocument } from "@/lib/site-documents/storage";

// Multipart upload goes through a route handler, not a Server Action, same reason
// materials upload does (avoids the Server Action body-size limit).
export const runtime = "nodejs";

function humanFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
  }

  if (file.size > MAX_SITE_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 15 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(buffer);

  if (!sniffed || sniffed.kind !== "PDF") {
    return NextResponse.json({ error: "Unrecognised file type. Only PDF is allowed." }, { status: 400 });
  }
  if (!declaredMimeMatchesSniffed(file.type, sniffed)) {
    return NextResponse.json({ error: "The file's contents don't match its declared type." }, { status: 400 });
  }

  const key = await writeSiteDocument(buffer);
  return NextResponse.json({ key, label: `PDF · ${humanFileSize(buffer.length)}` }, { status: 201 });
}
