import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/auth/ip";
import {
  MAX_UPLOAD_BYTES,
  sniffFileType,
  declaredMimeMatchesSniffed,
  writeUploadedFile,
  deleteUploadedFile,
} from "@/lib/materials/upload";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) {
    return NextResponse.json({ error: "Material not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 25 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(buffer);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Unrecognised file type. Allowed: PDF, PNG, JPEG, WebP." },
      { status: 400 },
    );
  }
  if (!declaredMimeMatchesSniffed(file.type, sniffed)) {
    return NextResponse.json(
      { error: "The file's contents don't match its declared type." },
      { status: 400 },
    );
  }

  const newStorageKey = await writeUploadedFile(buffer, sniffed.ext);

  try {
    await prisma.material.update({
      where: { id },
      data: {
        storageKey: newStorageKey,
        originalName: file.name,
        mimeType: sniffed.mime,
        kind: sniffed.kind,
        sizeBytes: buffer.length,
      },
    });
  } catch (error) {
    await deleteUploadedFile(newStorageKey);
    console.error("Failed to replace material file:", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  // Only unlink the old file once the DB row points at the new one.
  await deleteUploadedFile(material.storageKey);

  await writeAuditLog({
    actor: admin,
    action: "material.replace_file",
    entity: "Material",
    entityId: id,
    meta: { originalName: file.name },
    ip: getClientIp(await headers()),
  });

  return NextResponse.json({ ok: true });
}
