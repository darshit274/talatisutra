import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { sniffFileType, declaredMimeMatchesSniffed } from "@/lib/materials/upload";
import { MAX_SITE_IMAGE_BYTES, writeSiteImage } from "@/lib/site-images/storage";

// Multipart upload goes through a route handler, not a Server Action, same reason
// materials upload does (avoids the Server Action body-size limit).
export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  if (file.size > MAX_SITE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large. Maximum size is 5 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(buffer);

  if (!sniffed || sniffed.kind !== "IMAGE") {
    return NextResponse.json({ error: "Unrecognised image type. Allowed: PNG, JPEG, WebP." }, { status: 400 });
  }
  if (!declaredMimeMatchesSniffed(file.type, sniffed)) {
    return NextResponse.json({ error: "The file's contents don't match its declared type." }, { status: 400 });
  }

  const key = await writeSiteImage(buffer, sniffed.ext);
  return NextResponse.json({ key }, { status: 201 });
}
